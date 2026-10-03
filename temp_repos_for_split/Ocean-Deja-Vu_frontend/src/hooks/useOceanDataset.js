import { useState, useEffect } from 'react';
import { getField } from '../api';

const cache = {};

export function useOceanDataset(date) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!date) return;
    
    if (cache[date]) {
      setData(cache[date]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getField(date, "0")
      .then(json => {
        cache[date] = json;
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err);
        setLoading(false);
      });
  }, [date]);

  return { data, loading, error };
}
