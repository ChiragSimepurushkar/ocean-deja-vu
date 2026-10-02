import { useState, useEffect } from 'react';

export const useValidation = (region: string, season: string) => {
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [lineChartData, setLineChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // Simulate computing validation metrics based on region and season
    setTimeout(() => {
      if (!isMounted) return;
      const depths = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];
      
      // Tweak numbers slightly based on season to make it "reactive"
      const seasonOffset = season === 'Summer' ? 0.1 : season === 'Winter' ? -0.1 : 0;
      
      const rmseMain = depths.map(d => Math.max(0.2, 0.4 + (d / 1000) * 0.5 + Math.random() * 0.1 + seasonOffset));
      const rmseBaseline = depths.map(d => Math.max(0.4, 0.6 + (d / 1000) * 0.8 + Math.random() * 0.2 + seasonOffset));
      
      const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
      const computedHeatmap = seasons.map((s) => 
        depths.map(d => {
          const base = s === season ? 0.3 : 0;
          return Math.random() * 0.5 + (d < 100 ? 0.2 : 0) + base;
        })
      );

      setLineChartData({
        depths,
        rmseMain,
        rmseBaseline
      });
      
      setHeatmapData({
        seasons,
        depths,
        z: computedHeatmap
      });
      
      setLoading(false);
    }, 500);

    return () => {
      isMounted = false;
    };
  }, [region, season]);

  return { heatmapData, lineChartData, loading };
};
