import fs from 'node:fs';

const readDotEnv = (filePath) => {
  if (!fs.existsSync(filePath)) return {};

  const values = {};
  const content = fs.readFileSync(filePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;

    const [key, ...rest] = line.split('=');
    if (key && rest.length) {
      values[key.trim()] = rest.join('=').trim();
    }
  }

  return values;
};

const warnOnUnsafeServiceRole = () => {
  const envFiles = ['.env.local', '.env'];

  for (const filePath of envFiles) {
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('VITE_SUPABASE_SERVICE_ROLE_KEY=')) {
      console.warn(
        `Security warning: VITE_SUPABASE_SERVICE_ROLE_KEY is present in ${filePath}. Keep service-role keys in a server-only environment only.`
      );
    }
  }
};

warnOnUnsafeServiceRole();

const seedEnv = readDotEnv('.env.seed');
const localEnv = readDotEnv('.env.local');

const supabaseUrl =
  process.env.SUPABASE_URL || seedEnv.SUPABASE_URL || localEnv.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || seedEnv.SUPABASE_SERVICE_ROLE_KEY || localEnv.SUPABASE_SERVICE_ROLE_KEY;

const superAdminEmail =
  process.env.SUPERADMIN_EMAIL || seedEnv.SUPERADMIN_EMAIL || localEnv.SUPERADMIN_EMAIL || 'akelloantony9@gmail.com';
const superAdminUsername =
  process.env.SUPERADMIN_USERNAME || seedEnv.SUPERADMIN_USERNAME || localEnv.SUPERADMIN_USERNAME || 'superadmin';
const superAdminPassword = process.env.SUPERADMIN_PASSWORD || seedEnv.SUPERADMIN_PASSWORD || localEnv.SUPERADMIN_PASSWORD;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing Supabase configuration. Put SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in a server-only .env.seed file or export them before running this script.'
  );
  console.error('Do not put the service role key in a VITE_ variable used by the browser app.');
  process.exit(1);
}

const authAdminUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users`;

const adminRequest = async (path = '', options = {}) => {
  const response = await fetch(`${authAdminUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = responseBody.msg || responseBody.message || responseBody.error_description || responseBody.error;
    throw new Error(message || `Supabase Auth admin request failed (${response.status}).`);
  }

  return responseBody;
};

let userList;
try {
  userList = await adminRequest('?page=1&per_page=1000');
} catch (error) {
  console.error('Failed to list users:', error.message);
  process.exit(1);
}

const existingUser = userList.users?.find(
  (user) => user.email?.toLowerCase() === superAdminEmail.toLowerCase()
);

if (existingUser) {
  const existingAppMetadata = existingUser.app_metadata ?? {};
  try {
    await adminRequest(`/${encodeURIComponent(existingUser.id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        app_metadata: {
          ...existingAppMetadata,
          role: 'superadmin',
        },
      }),
    });
  } catch (error) {
    console.error('Failed to update existing superadmin user:', error.message);
    process.exit(1);
  }

  console.log(`Superadmin already exists for ${superAdminEmail}. Server-controlled role was set to superadmin.`);
  console.log(`Username: ${superAdminUsername}`);
  process.exit(0);
}

if (!superAdminPassword || superAdminPassword.length < 12) {
  console.error('Set SUPERADMIN_PASSWORD to a unique password at least 12 characters long in .env.seed or the process environment.');
  process.exit(1);
}

let createdUser;
try {
  createdUser = await adminRequest('', {
    method: 'POST',
    body: JSON.stringify({
      email: superAdminEmail,
      password: superAdminPassword,
      email_confirm: true,
      app_metadata: {
        role: 'superadmin',
      },
      user_metadata: {
        role: 'user',
        full_name: superAdminUsername,
        username: superAdminUsername,
      },
    }),
  });
} catch (error) {
  console.error('Failed to create superadmin account:', error.message);
  process.exit(1);
}

console.log('Superadmin account created successfully.');
console.log(`Email: ${superAdminEmail}`);
console.log(`Username: ${superAdminUsername}`);
console.log(`User ID: ${createdUser.id}`);
console.log('Use a server-only secret store for the service-role key. Rotate the password after first login.');
