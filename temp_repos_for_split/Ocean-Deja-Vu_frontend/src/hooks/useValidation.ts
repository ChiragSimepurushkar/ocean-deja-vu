import { useState, useEffect } from 'react';
import { getValidation } from '../api';

const REGION_MAP: Record<string, string> = {
  'Arabian Sea': 'Arabian Sea',
  'Bay of Bengal': 'Bay of Bengal',
  'Equatorial Indian Ocean': 'Equatorial Indian Ocean',
  'Southern Ocean': 'Southern Ocean',
};

export const useValidation = (region: string, season: string) => {
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [lineChartData, setLineChartData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    getValidation(region, season)
      .then((data: any) => {
        if (!isMounted) return;
        setLineChartData({
          depths: data.depths,
          rmseMain: data.rmse_main,
          rmseBaseline: data.rmse_baseline,
        });
        setHeatmapData({
          seasons: data.heatmap.seasons,
          depths: data.heatmap.depths,
          z: data.heatmap.z,
        });
        setSummary(data.summary);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { isMounted = false; };
  }, [region, season]);

  return { heatmapData, lineChartData, summary, loading, error };
};
