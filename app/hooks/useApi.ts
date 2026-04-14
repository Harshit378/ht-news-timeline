'use client'

import { useState } from "react";
import axios from "axios";

export function useApi<T = any>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const request = async (url: string, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios(url, options);
      setData(response.data);
      return response.data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, request };
}