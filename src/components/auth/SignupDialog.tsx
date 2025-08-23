// This file is no longer used - signup flow has been removed in favor of ephemeral identities.

interface SignupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const SignupDialog: React.FC<SignupDialogProps> = ({ isOpen, onClose, onComplete }) => {
  // Redirect to login dialog instead
  if (isOpen) {
    onClose();
    if (onComplete) {
      onComplete();
    }
  }

  return null;
};

export default SignupDialog;