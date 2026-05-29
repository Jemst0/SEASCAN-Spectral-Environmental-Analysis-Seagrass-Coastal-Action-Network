% Load the saved MATLAB model
load('C:\Users\James\OneDrive\Documents\James\BSU\3202\Software Design\SEASCAN\trained_model\Coastal_Area_NRG\Coastal_Area_Classifier.mat');

% Export the Deep Learning Network to ONNX
exportONNXNetwork(net, 'C:\Users\James\OneDrive\Documents\James\BSU\3202\Software Design\SEASCAN\trained_model\Code\coastal_classifier.onnx');

% Save normalization variables (mu and sigma) for Python usage
save('C:\Users\James\OneDrive\Documents\James\BSU\3202\Software Design\SEASCAN\trained_model\Code\normalization.mat', 'mu', 'sigma');

disp('Export complete!');
exit;