import DataManagementPage from '../data-management/DataManagementPage';
import type { ClassificationRecord } from '../data-management/types';

type DataPageProps = {
  onTrendAnalysis?: (records: ClassificationRecord[]) => void;
  canManage?: boolean;
};

export default function DataPage({ onTrendAnalysis, canManage }: DataPageProps) {
  return <DataManagementPage onTrendAnalysis={onTrendAnalysis} canManage={canManage} />;
}
