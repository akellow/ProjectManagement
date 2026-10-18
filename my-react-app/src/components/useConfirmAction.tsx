import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";

type Confirmation = {
  message: string;
  actionLabel: string;
};

export function useConfirmAction() {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirmAction = useCallback((message: string, actionLabel = "Move to Trash") =>
    new Promise<boolean>((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setConfirmation({ message, actionLabel });
    }), []);

  const close = (confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setConfirmation(null);
  };

  const confirmationDialog: ReactNode = (
    <Dialog open={confirmation !== null} onClose={() => close(false)} aria-labelledby="confirm-action-title">
      <DialogTitle id="confirm-action-title">Confirm action</DialogTitle>
      <DialogContent>
        <DialogContentText>{confirmation?.message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => close(false)}>Cancel</Button>
        <Button color="error" variant="contained" onClick={() => close(true)}>{confirmation?.actionLabel}</Button>
      </DialogActions>
    </Dialog>
  );

  return { confirmAction, confirmationDialog };
}
