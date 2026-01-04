import { createContext, useContext, useState, useEffect } from 'react';
import { configAPI } from '../services/api';

const DateFormatContext = createContext();

export const DateFormatProvider = ({ children }) => {
  const [dateFormat, setDateFormat] = useState('US');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDateFormat = async () => {
      try {
        const response = await configAPI.getSystemConfig();
        if (response.success && response.data.dateFormat) {
          setDateFormat(response.data.dateFormat);
        }
      } catch (error) {
        console.error('Failed to load date format:', error);
      } finally {
        setLoading(false);
      }
    };
    loadDateFormat();
  }, []);

  const updateDateFormat = async (format) => {
    try {
      await configAPI.updateSystemConfig({ dateFormat: format });
      setDateFormat(format);
    } catch (error) {
      console.error('Failed to update date format:', error);
      throw error;
    }
  };

  return (
    <DateFormatContext.Provider value={{ dateFormat, updateDateFormat, loading }}>
      {children}
    </DateFormatContext.Provider>
  );
};

export const useDateFormat = () => {
  const context = useContext(DateFormatContext);
  if (!context) {
    throw new Error('useDateFormat must be used within a DateFormatProvider');
  }
  return context;
};
