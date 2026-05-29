// Utility to safely access electronAPI from the preload context
declare global {
  interface Window {
    electronAPI?: {
      selectFolder: () => Promise<string | null>;
      runPredictor: (folderPath: string) => Promise<any>;
      db: {
        saveClassification: (classification: any) => Promise<{ success: boolean; id?: number; error?: string }>;
        getClassificationsByStudyArea: (studyAreaName: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
        getAllClassifications: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
        getUniqueStudyAreas: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
        deleteClassification: (id: number) => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}

export const useDatabase = () => {
  return window.electronAPI?.db || null;
};

export default useDatabase;
