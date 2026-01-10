import { Modal } from "./Modal";
import { PackagePreview } from "./PackagePreview";

interface PackagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  ipfsCID: string;
  proposalId: string;
}

export const PackagePreviewModal: React.FC<PackagePreviewModalProps> = ({
  isOpen,
  onClose,
  ipfsCID,
  proposalId,
}) => {
  return (
    <Modal
      show={isOpen}
      onClose={onClose}
      title={`Package Details - Proposal #${proposalId.slice(0, 8)}...`}
      size="xl"
    >
      <PackagePreview ipfsCID={ipfsCID} />
    </Modal>
  );
};
