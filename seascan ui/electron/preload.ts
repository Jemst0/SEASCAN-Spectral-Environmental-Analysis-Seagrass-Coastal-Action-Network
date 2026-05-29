import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  runPredictor: (folderPath: string) => ipcRenderer.invoke('run-predictor', folderPath),
  db: {
    saveClassification: (classification: any) => ipcRenderer.invoke('db:saveClassification', classification),
    getClassificationsByStudyArea: (studyAreaName: string) => ipcRenderer.invoke('db:getClassificationsByStudyArea', studyAreaName),
    getAllClassifications: () => ipcRenderer.invoke('db:getAllClassifications'),
    getUniqueStudyAreas: () => ipcRenderer.invoke('db:getUniqueStudyAreas'),
    deleteClassification: (id: number) => ipcRenderer.invoke('db:deleteClassification', id),
  }
})