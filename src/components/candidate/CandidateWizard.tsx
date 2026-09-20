import React from 'react';
import { DynamicTrackWizard } from './DynamicTrackWizard';

interface CandidateWizardProps {
  candidate: {
    id: string;
    full_name: string;
    joining_id: string;
    cnic: string;
    mobile: string;
    track?: string;
    branches?: { name: string; address?: string };
    zones?: { name: string };
  };
  initialApplication: any;
  onSubmitted: () => void;
  onViewStatusTracker: () => void;
}

export const CandidateWizard: React.FC<CandidateWizardProps> = (props) => {
  return <DynamicTrackWizard {...props} />;
};
