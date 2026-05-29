import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'child_process'
import { initializeDatabase, saveClassification, getClassificationsByStudyArea, getAllClassifications, getUniqueStudyAreas, deleteClassification, closeDatabase } from './database'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// The built directory structure
process.env.DIST = join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public')

let win: BrowserWindow | null
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(join(process.env.DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('quit', () => {
  closeDatabase()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  initializeDatabase()
  createWindow()
})

// IPC handling for Python interaction
ipcMain.handle('run-predictor', async (event, folderPath) => {
  return new Promise((resolve, reject) => {
    // In production we would execute a pyinstaller binary.
    // In development we run python directly.
    const pythonExe = 'python' // Ideally use pyinstaller's packaged exe in prod
    const predictorScript = join(__dirname, '../../trained_model/Code/model_runner.py')
    
    const pyProcess = spawn(pythonExe, [predictorScript, folderPath])

    let output = ''
    let error = ''

    pyProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    pyProcess.stderr.on('data', (data) => {
      error += data.toString()
    })

    pyProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, data: output })
      } else {
        reject({ success: false, error: error })
      }
    })
  })
})

ipcMain.handle('select-folder', async () => {
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  })
  if (result.canceled) return null;
  return result.filePaths[0];
})

// Database IPC handlers
ipcMain.handle('db:saveClassification', async (event, classification) => {
  try {
    const id = saveClassification(classification)
    return { success: true, id }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('db:getClassificationsByStudyArea', async (event, studyAreaName) => {
  try {
    const classifications = getClassificationsByStudyArea(studyAreaName)
    return { success: true, data: classifications }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('db:getAllClassifications', async () => {
  try {
    const classifications = getAllClassifications()
    return { success: true, data: classifications }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('db:getUniqueStudyAreas', async () => {
  try {
    const areas = getUniqueStudyAreas()
    return { success: true, data: areas }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('db:deleteClassification', async (event, id) => {
  try {
    const success = deleteClassification(id)
    return { success }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})