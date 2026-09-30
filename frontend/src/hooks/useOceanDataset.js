import { useState, useEffect } from 'react';

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
    fetch(`/data/${date}.json`)
      .then(res => {
        if (!res.ok) throw new Error('Data not found for date: ' + date);
        return res.json();
      })
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
