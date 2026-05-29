function coastal_area_classify_ui
%COASTAL_AREA_CLASSIFY_UI UI to classify coastal images using the latest
% trained model.
%   This UI lets you:
%     - Select a ZIP or folder dataset with Sentinel-2 bands and True Color
%   Then it calls coastal_classify_only(dataFolder), which automatically
%   loads the most recent model exported by coastal_area_draft.m.

    fig = uifigure('Name','SEASCAN: Coastal Area Classification', ...
                   'Position',[150 150 500 260]);

    % Status label
    lblStatus = uilabel(fig, ...
        'Position',[20 215 460 22], ...
        'Text','Select a dataset, then run classification with latest model.');

    % Dataset section
    uilabel(fig, ...
        'Position',[20 185 80 22], ...
        'Text','Data folder:');

    edtFolder = uieditfield(fig, 'text', ...
        'Position',[100 185 380 22], ...
        'Editable','off');

    btnZip = uibutton(fig, 'push', ...
        'Position',[40 145 180 30], ...
        'Text','Select ZIP dataset...', ...
        'ButtonPushedFcn', @(btn,evt) onSelectZip());

    btnFolder = uibutton(fig, 'push', ...
        'Position',[260 145 180 30], ...
        'Text','Select folder dataset...', ...
        'ButtonPushedFcn', @(btn,evt) onSelectFolder());

    % Run button
    btnRun = uibutton(fig, 'push', ...
        'Position',[180 55 140 30], ...
        'Text','Run classification', ...
        'ButtonPushedFcn', @(btn,evt) onRunClassification());

    % Store state
    fig.UserData.dataFolder = '';

    %--------------------------------------------------------------
    function onSelectZip
        [file, path] = uigetfile('*.zip','Select coastal dataset ZIP');
        if isequal(file,0)
            return;
        end

        zipFile = fullfile(path,file);

        destRoot = fullfile(tempdir, 'CoastalDataset_Inference');
        if ~exist(destRoot,'dir')
            mkdir(destRoot);
        end

        destFolder = fullfile(destRoot, erase(file, '.zip'));
        if exist(destFolder,'dir')
            try
                rmdir(destFolder,'s');
            catch
            end
        end
        mkdir(destFolder);

        lblStatus.Text = 'Unzipping dataset for classification...';
        drawnow;
        unzip(zipFile, destFolder);

        fig.UserData.dataFolder = destFolder;
        edtFolder.Value = destFolder;

    end

    %--------------------------------------------------------------
    function onSelectFolder
        folder = uigetdir(pwd, 'Select coastal dataset folder');
        if isequal(folder,0)
            return;
        end

        fig.UserData.dataFolder = folder;
        edtFolder.Value = folder;

    end

    %--------------------------------------------------------------
    function onRunClassification
        dataFolder = string(fig.UserData.dataFolder);

        if strlength(dataFolder) == 0
            lblStatus.Text = 'Please select a ZIP or folder dataset first.';
            return;
        end

        if ~isfolder(dataFolder)
            lblStatus.Text = 'Selected data folder is not valid.';
            return;
        end

        lblStatus.Text = 'Running classification with latest trained model...';
        drawnow;

        try
            coastal_classify_only(dataFolder);
            lblStatus.Text = 'Classification completed successfully.';
        catch ME
            lblStatus.Text = ['Error during classification: ' ME.message];
            rethrow(ME);
        end
    end

end
