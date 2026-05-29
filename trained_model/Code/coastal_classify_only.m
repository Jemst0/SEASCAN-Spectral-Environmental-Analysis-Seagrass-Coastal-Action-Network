function coastal_classify_only(dataFolder)
%COASTAL_CLASSIFY_ONLY Classify coastal satellite images using pre-trained CNN model
%   Loads the latest trained model from Model_Export and runs inference on the data folder.
%   
%   Usage: coastal_classify_only(dataFolder)
%   
%   Inputs:
%     dataFolder - Path to folder containing Sentinel-2 band GeoTIFFs and True Color image
%
%   Expected files in dataFolder:
%     - B01.tiff, B02.tiff, ... B12.tiff (Sentinel-2 bands)
%     - *True_color.tiff (True Color composite)
%     - Ground_Truth.csv (optional, for validation)

try
    %% ====================================================================
    % STEP 1: INITIALIZATION & LOAD MODEL
    % =====================================================================
    fprintf('\n=== SEASCAN: Coastal Classification (Inference Only) ===\n\n');
    
    if ~isstring(dataFolder) && ~ischar(dataFolder)
        error('dataFolder must be a string or character array');
    end
    
    if ~isfolder(dataFolder)
        error('dataFolder ''%s'' does not exist', dataFolder);
    end
    
    % Find and load the pre-trained model
    scriptFolder = fileparts(mfilename('fullpath'));
    modelExportFolder = fullfile(scriptFolder, 'Model_Export');
    modelPath = fullfile(modelExportFolder, 'coastal_area_latest_model.mat');
    
    if ~isfile(modelPath)
        error('Pre-trained model not found at %s. Please train a model first using coastal_area_draft.m', modelPath);
    end
    
    fprintf('Loading pre-trained model from: %s\n', modelPath);
    modelData = load(modelPath, 'net', 'mu', 'sigma', 'classNames', 'classCats', 'numBands', 'numClasses');
    
    net = modelData.net;
    mu = modelData.mu;
    sigma = modelData.sigma;
    classNames = modelData.classNames;
    classCats = modelData.classCats;
    numBands = modelData.numBands;
    numClasses = modelData.numClasses;
    
    fprintf('Model loaded successfully. Ready for inference.\n\n');
    
    % Configuration
    bandLabels = ["B01","B02","B03","B04","B05","B06","B07","B08","B8A","B09","B11","B12"];
    baseBandCount = 12;
    tciPattern = fullfile(dataFolder, '*True_color.tiff');
    csvFile = fullfile(dataFolder, 'Ground_Truth.csv');
    miniBatchSize = 128;
    
    %% ====================================================================
    % STEP 2: LOAD SATELLITE BANDS & COMPUTE SPECTRAL INDICES
    % =====================================================================
    fprintf('STEP 2: Loading satellite bands...\n');
    
    allTiffFiles = dir(fullfile(dataFolder, "*.tif*"));
    bandData = cell(baseBandCount, 1);
    
    for b = 1:baseBandCount
        searchPattern = upper(string(bandLabels(b)));
        for i = 1:length(allTiffFiles)
            nameUpper = upper(allTiffFiles(i).name);
            if contains(nameUpper, searchPattern) && ~contains(nameUpper, 'TRUE')
                img = imread(fullfile(dataFolder, allTiffFiles(i).name));
                if ndims(img) > 2
                    img = img(:,:,1);
                end
                bandData{b} = double(img);
                break;
            end
        end
        if isempty(bandData{b})
            error("Band %s not found in folder %s", bandLabels(b), dataFolder);
        end
    end
    
    % Build 3D Band Matrix [Rows x Cols x 12]
    baseSize = size(bandData{1});
    bandMatrix = zeros([baseSize, baseBandCount], 'double');
    for k = 1:baseBandCount
        bandMatrix(:,:,k) = bandData{k};
    end
    [rows, cols, ~] = size(bandMatrix);
    fprintf('  Loaded %d bands. Image size: %d x %d pixels\n', baseBandCount, rows, cols);
    
    % Compute Spectral Indices
    fprintf('Computing spectral indices...\n');
    B02 = bandMatrix(:,:,2);   % Blue
    B03 = bandMatrix(:,:,3);   % Green
    B04 = bandMatrix(:,:,4);   % Red
    B08 = bandMatrix(:,:,8);   % NIR
    B11 = bandMatrix(:,:,11);  % SWIR
    
    NDVI = (B08 - B04) ./ (B08 + B04 + eps);
    NDWI = (B03 - B08) ./ (B03 + B08 + eps);
    MNDWI = (B03 - B11) ./ (B03 + B11 + eps);
    Brightness = (B02 + B03 + B04) / 3;
    
    % Append indices to bandMatrix
    bandMatrix(:,:,13) = NDVI;
    bandMatrix(:,:,14) = NDWI;
    bandMatrix(:,:,15) = MNDWI;
    bandMatrix(:,:,16) = Brightness;
    
    % Create masks
    waterMask = (NDWI > 0.02) | (MNDWI > 0.02);
    landMask = ~waterMask;
    fprintf('  Spectral indices computed. Feature stack: %dx%dx%d\n', rows, cols, 16);
    
    % Load True Color Image
    tciList = dir(tciPattern);
    if isempty(tciList)
        error('True Color image (*True_color.tiff) not found in %s', dataFolder);
    end
    tciFile = fullfile(dataFolder, tciList(1).name);
    tciImage = imread(char(tciFile));
    [~, R] = readgeoraster(char(tciFile));
    fprintf('  True Color image loaded: %s\n\n', tciList(1).name);
    
    %% ====================================================================
    % STEP 3: LOAD GROUND TRUTH (IF AVAILABLE)
    % =====================================================================
    labelImage = zeros(rows, cols, 'uint8');
    
    if isfile(csvFile)
        fprintf('STEP 3: Parsing ground truth CSV...\n');
        try
            T = readtable(csvFile);
            lat_array = T.Latitude;
            lon_array = T.Longitude;
            class_array = T.Value;
            
            numLabeled = 0;
            for i = 1:length(lat_array)
                lat = lat_array(i);
                lon = lon_array(i);
                label = class_array(i);
                
                if isnan(lat) || isnan(lon), continue; end
                
                if strcmp(R.CoordinateSystemType, 'geographic')
                    [x_col, y_row] = geographicToIntrinsic(R, lat, lon);
                else
                    [x_col, y_row] = worldToIntrinsic(R, lon, lat);
                end
                
                col = round(x_col);
                row = round(y_row);
                
                if row >= 1 && row <= rows && col >= 1 && col <= cols
                    labelImage(row, col) = uint8(label);
                    numLabeled = numLabeled + 1;
                end
            end
            fprintf('  Mapped %d ground truth points\n\n', numLabeled);
        catch ME
            fprintf('  Warning: Could not load ground truth CSV: %s\n\n', ME.message);
        end
    else
        fprintf('STEP 3: No ground truth CSV found (optional)\n\n');
    end
    
    %% ====================================================================
    % STEP 6: FULL IMAGE INFERENCE
    % =====================================================================
    fprintf('STEP 6: Running CNN inference on all pixels...\n');
    
    % Flatten and prepare features
    featuresAll = reshape(bandMatrix, rows*cols, numBands);
    labelsAllFlat = reshape(labelImage, rows*cols, 1);
    
    % Predict unknown pixels (those without ground truth)
    unknownMaskAll = (labelsAllFlat == 0);
    X_unknown = featuresAll(unknownMaskAll, :);
    
    newLabels = labelsAllFlat;
    
    if ~isempty(X_unknown)
        % Standardize using saved parameters
        X_unknown_z = (X_unknown - mu) ./ sigma;
        Xunknown4 = reshape(X_unknown_z', [numBands, 1, 1, size(X_unknown_z, 1)]);
        
        % Classify
        [Ypred_unknown_raw, scores_unknown] = classify(net, Xunknown4, 'MiniBatchSize', miniBatchSize);
        
        % Apply post-processing: Cloud/Sand correction
        cloudLabel = categorical("Clouds", classNames);
        sandLabel = categorical("Sand", classNames);
        
        iCloud = find(strcmp(classCats, 'Clouds'));
        iSand = find(strcmp(classCats, 'Sand'));
        
        Ypred_unknown = Ypred_unknown_raw;
        if ~isempty(iCloud) && ~isempty(iSand)
            isCloud_u = (Ypred_unknown == cloudLabel);
            lowConf_u = scores_unknown(:, iCloud) < 0.5;
            sandHigh_u = scores_unknown(:, iSand) > 0.5;
            flipMask_u = isCloud_u & lowConf_u & sandHigh_u;
            Ypred_unknown(flipMask_u) = sandLabel;
        end
        
        newLabels(unknownMaskAll) = double(Ypred_unknown);
    end
    
    % Preserve original ground truth
    newLabels(labelsAllFlat ~= 0) = labelsAllFlat(labelsAllFlat ~= 0);
    classifiedImage = reshape(newLabels, rows, cols);
    
    fprintf('  Inference complete\n\n');
    
    %% ====================================================================
    % STEP 7: RULE-BASED CLEANUP
    % =====================================================================
    fprintf('STEP 7: Applying cleanup rules...\n');
    
    classifiedClean = classifiedImage;
    unlabeledMaskImage = reshape(labelsAllFlat == 0, rows, cols);
    
    % Inland cleanup
    inlandMask = (NDWI < -0.05) & ~waterMask & unlabeledMaskImage;
    classifiedClean(inlandMask & (classifiedClean == 2)) = 0;
    
    % Strong water cleanup
    waterStrongMask = waterMask & (NDWI > 0) & unlabeledMaskImage;
    classifiedClean(waterStrongMask & (classifiedClean == 2)) = 3;
    
    % Coastal buffer enforcement
    kernel = ones(11,11);
    coastalBufferMask = conv2(double(waterMask), kernel, 'same') > 0;
    inlandFarMask = ~coastalBufferMask & unlabeledMaskImage;
    classifiedClean(inlandFarMask & (classifiedClean == 2 | classifiedClean == 3)) = 0;
    
    classifiedImage = classifiedClean;
    fprintf('  Cleanup rules applied\n\n');
    
    %% ====================================================================
    % STEP 8: VISUALIZATION & EXPORT
    % =====================================================================
    fprintf('STEP 8: Visualization and export...\n');
    
    % Create overlay
    rgbBase = im2double(tciImage);
    overlayR = zeros(rows, cols);
    overlayG = zeros(rows, cols);
    overlayB = zeros(rows, cols);
    
    coastalMask = ~landMask;
    
    % Seagrass = Green
    overlayG(classifiedImage == 1 & coastalMask) = 1;
    
    % Sand = Yellow
    overlayR(classifiedImage == 2 & coastalMask) = 1;
    overlayG(classifiedImage == 2 & coastalMask) = 1;
    
    % Sea = Blue
    overlayB(classifiedImage == 3 & coastalMask) = 1;
    
    % Clouds = White
    overlayR(classifiedImage == 4 & coastalMask) = 1;
    overlayG(classifiedImage == 4 & coastalMask) = 1;
    overlayB(classifiedImage == 4 & coastalMask) = 1;
    
    overlay = cat(3, overlayR, overlayG, overlayB);
    
    % Display classification
    figure('Name','Coastal Classification with Land Intact');
    imshow(rgbBase); hold on;
    h = imshow(overlay);
    set(h,'AlphaData', 0.5);
    title('Sand=Yellow | Seagrass=Green | Water=Blue | Clouds=White | Land=Original');
    
    % Save overlay PNG
    try
        alpha = 0.5;
        blend = rgbBase;
        mask = any(overlay > 0, 3);
        for c = 1:3
            chBase = blend(:,:,c);
            chOv = overlay(:,:,c);
            chBase(mask) = (1-alpha) * chBase(mask) + alpha * chOv(mask);
            blend(:,:,c) = chBase;
        end
        
        [~, tciName, ~] = fileparts(char(tciFile));
        dateMatch = regexp(tciName, '\d{4}-\d{2}-\d{2}', 'match');
        if ~isempty(dateMatch)
            dateStr = dateMatch{1};
        else
            dateStr = 'unknown_date';
        end
        
        outName = sprintf('classified_overlay_%s.png', dateStr);
        outPath = fullfile(dataFolder, outName);
        imwrite(blend, outPath);
        fprintf('  Saved overlay: %s\n', outName);
    catch ME
        fprintf('  Warning: Could not save overlay PNG: %s\n', ME.message);
    end
    
    % Compute and export metrics
    totalCoastalPixels = nnz(coastalMask);
    seagrassCount = nnz(classifiedImage == 1 & coastalMask);
    sandCount = nnz(classifiedImage == 2 & coastalMask);
    waterCount = nnz(classifiedImage == 3 & coastalMask);
    cloudCount = nnz(classifiedImage == 4);
    
    fprintf('\n=== COASTAL METRICS ===\n');
    fprintf('Total coastal pixels: %d\n', totalCoastalPixels);
    fprintf('Seagrass pixels:      %d (%.2f%%)\n', seagrassCount, 100*seagrassCount/totalCoastalPixels);
    fprintf('Sand pixels:          %d (%.2f%%)\n', sandCount, 100*sandCount/totalCoastalPixels);
    fprintf('Water pixels:         %d (%.2f%%)\n', waterCount, 100*waterCount/totalCoastalPixels);
    fprintf('Cloud pixels:         %d\n\n', cloudCount);
    
    % Export CSV metrics
    try
        metricsTable = table(totalCoastalPixels, seagrassCount, sandCount, waterCount, cloudCount, ...
            'VariableNames', {'TotalCoastalPixels','SeagrassPixels','SandPixels','WaterPixels','CloudPixels'});
        
        timestampStr = datestr(now, 'yyyy-mm-dd_HHMMSS');
        metricsFile = fullfile(dataFolder, ['coastal_metrics_' timestampStr '.csv']);
        writetable(metricsTable, metricsFile);
        fprintf('  Saved metrics: coastal_metrics_%s.csv\n', timestampStr);
    catch ME
        fprintf('  Warning: Could not save metrics CSV: %s\n', ME.message);
    end
    
    fprintf('\n=== Classification complete ===\n\n');
    
catch ME
    fprintf('\n!!! ERROR during classification !!!\n');
    fprintf('Message: %s\n', ME.message);
    fprintf('Stack trace:\n');
    for i = 1:length(ME.stack)
        fprintf('  %s (line %d)\n', ME.stack(i).file, ME.stack(i).line);
    end
    rethrow(ME);
end

end