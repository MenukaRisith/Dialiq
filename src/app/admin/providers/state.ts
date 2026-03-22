export interface CredentialActionState {
  status: "idle" | "success" | "error";
  message: string;
}

export const initialCredentialActionState: CredentialActionState = {
  status: "idle",
  message: "",
};
