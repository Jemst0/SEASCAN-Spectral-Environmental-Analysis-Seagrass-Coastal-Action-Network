export default function AccuracyPanel() {
  const confusionMatrix = [
    [145, 8, 3, 2],
    [6, 132, 7, 1],
    [4, 5, 118, 4],
    [2, 3, 5, 98],
  ];

  const classes = ['Water', 'Dense SG', 'Medium SG', 'Sparse SG'];

  return (
    <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          Ground Truth Accuracy
        </h3>
        <p className="text-[#00C9A7]/70 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
          AccuracyAssessor | validate_model(), confusion_matrix()
        </p>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gradient-to-br from-[#3DDC84]/10 to-[#00C9A7]/10 border border-[#3DDC84]/30 rounded-xl">
            <p className="text-gray-400 text-xs mb-1">Overall Accuracy</p>
            <p className="text-3xl font-bold text-[#3DDC84]" style={{ fontFamily: 'Space Mono, monospace' }}>
              92.8%
            </p>
          </div>
          <div className="p-4 bg-gradient-to-br from-[#4A9EFF]/10 to-[#00C9A7]/10 border border-[#4A9EFF]/30 rounded-xl">
            <p className="text-gray-400 text-xs mb-1">Kappa Coefficient</p>
            <p className="text-3xl font-bold text-[#4A9EFF]" style={{ fontFamily: 'Space Mono, monospace' }}>
              0.89
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-white text-sm font-medium mb-3">Confusion Matrix</p>
        <div className="bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-xl p-3">
          <div className="grid grid-cols-5 gap-1">
            <div />
            {classes.map((cls, i) => (
              <div key={`header-${i}`} className="text-center">
                <span className="text-[#00C9A7] text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
                  {cls.split(' ')[0]}
                </span>
              </div>
            ))}

            {confusionMatrix.map((row, i) => (
              <div key={`row-${i}`} className="contents">
                <div className="flex items-center justify-end pr-2">
                  <span className="text-[#00C9A7] text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
                    {classes[i].split(' ')[0]}
                  </span>
                </div>
                {row.map((val, j) => {
                  const max = Math.max(...row);
                  const isCorrect = i === j;
                  const intensity = val / max;
                  return (
                    <div
                      key={`cell-${i}-${j}`}
                      className="aspect-square flex items-center justify-center rounded text-xs font-medium"
                      style={{
                        backgroundColor: isCorrect
                          ? `rgba(61, 220, 132, ${intensity * 0.5})`
                          : `rgba(74, 158, 255, ${intensity * 0.3})`,
                        color: val > max * 0.5 ? '#ffffff' : '#9CA3AF',
                        fontFamily: 'Space Mono, monospace',
                      }}
                    >
                      {val}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-[#00C9A7]/20">
            <p className="text-gray-400 text-xs text-center">Predicted (columns) vs Actual (rows)</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="p-3 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-lg">
          <p className="text-gray-400 text-xs mb-1">Precision</p>
          <p className="text-white font-medium" style={{ fontFamily: 'Space Mono, monospace' }}>
            91.4%
          </p>
        </div>
        <div className="p-3 bg-[#020D1A]/50 border border-[#00C9A7]/20 rounded-lg">
          <p className="text-gray-400 text-xs mb-1">Recall</p>
          <p className="text-white font-medium" style={{ fontFamily: 'Space Mono, monospace' }}>
            90.9%
          </p>
        </div>
      </div>
    </div>
  );
}
