import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

const client = new ApolloClient({
    link: new HttpLink({ uri: "http://localhost:5138/graphql" }),
    cache: new InMemoryCache(),
});

export default client;