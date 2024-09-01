import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Platform, Button, ScrollView } from 'react-native';
import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';

// Helper function to get the start and end of a local day
const getLocalDayRange = (date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  startOfDay.setTime(startOfDay.getTime() - startOfDay.getTimezoneOffset() * 60 * 1000); // Adjust to UTC

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  endOfDay.setTime(endOfDay.getTime() - endOfDay.getTimezoneOffset() * 60 * 1000); // Adjust to UTC

  return {
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString(),
  };
};

// Helper function to get start and end of an hour interval
const getHourRange = (date, hour) => {
  const startOfHour = new Date(date);
  startOfHour.setHours(hour, 0, 0, 0);
  startOfHour.setTime(startOfHour.getTime() - startOfHour.getTimezoneOffset() * 60 * 1000); // Adjust to UTC

  const endOfHour = new Date(date);
  endOfHour.setHours(hour, 59, 59, 999);
  endOfHour.setTime(endOfHour.getTime() - endOfHour.getTimezoneOffset() * 60 * 1000); // Adjust to UTC

  return {
    startOfHour: startOfHour.toISOString(),
    endOfHour: endOfHour.toISOString(),
  };
};

const useHealthData = (selectedDate) => {
  const [stepsByHour, setStepsByHour] = useState({});
  const [caloriesByHour, setCaloriesByHour] = useState({});
  const [totalSteps, setTotalSteps] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);
  const [permissions, setPermissions] = useState([]);
  const [permissionError, setPermissionError] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const init = async () => {
      try {
        if (!(await initialize())) {
          console.log('Failed to initialize Health Connect');
          return;
        }

        const grantedPermissions = await requestPermission([
          { accessType: 'read', recordType: 'Steps' },
          { accessType: 'read', recordType: 'TotalCaloriesBurned' },
        ]);

        console.log('Granted permissions:', grantedPermissions);
        setPermissions(grantedPermissions);

        fetchHealthData();
      } catch (error) {
        console.error('Initialization or permission error:', error);
        setPermissionError('Initialization or permission error.');
      }
    };

    const fetchHealthData = async () => {
      try {
        const { startOfDay, endOfDay } = getLocalDayRange(selectedDate);
        const stepsMap = {};
        const caloriesMap = {};

        // Fetch total steps and calories for the day
        const timeRangeFilter = {
          operator: 'between',
          startTime: startOfDay,
          endTime: endOfDay,
        };

        const stepsData = await readRecords('Steps', { timeRangeFilter });
        const caloriesData = await readRecords('TotalCaloriesBurned', { timeRangeFilter });

        console.log(`Total Steps data for ${selectedDate.toDateString()}:`, stepsData);
        console.log(`Total Calories data for ${selectedDate.toDateString()}:`, caloriesData);

        const totalStepsCount = stepsData?.records?.reduce((sum, record) => sum + (record.count || 0), 0) || 0;
        const totalCaloriesCount = caloriesData?.records?.reduce((sum, record) => sum + (record.energy?.inKilocalories || 0), 0) || 0;

        setTotalSteps(totalStepsCount);
        setTotalCalories(totalCaloriesCount);

        // Fetch steps and calories per hour
        for (let hour = 0; hour < 24; hour++) {
          const { startOfHour, endOfHour } = getHourRange(selectedDate, hour);

          const hourlyFilter = {
            operator: 'between',
            startTime: startOfHour,
            endTime: endOfHour,
          };

          const hourlyStepsData = await readRecords('Steps', { timeRangeFilter: hourlyFilter });
          const hourlyCaloriesData = await readRecords('TotalCaloriesBurned', { timeRangeFilter: hourlyFilter });

          console.log(`Steps data for ${selectedDate.toDateString()} Hour ${hour}:`, hourlyStepsData);
          console.log(`Calories data for ${selectedDate.toDateString()} Hour ${hour}:`, hourlyCaloriesData);

          const hourlyStepsCount = hourlyStepsData?.records?.reduce((sum, record) => sum + (record.count || 0), 0) || 0;
          const hourlyCaloriesCount = hourlyCaloriesData?.records?.reduce((sum, record) => sum + (record.energy?.inKilocalories || 0), 0) || 0;

          stepsMap[hour] = hourlyStepsCount;
          caloriesMap[hour] = hourlyCaloriesCount;
        }

        setStepsByHour(stepsMap);
        setCaloriesByHour(caloriesMap);
      } catch (error) {
        console.error('Fetching health data error:', error);
        setFetchError('Fetching health data error.');
      }
    };

    init();
  }, [selectedDate]);

  return { stepsByHour, caloriesByHour, totalSteps, totalCalories, permissions, permissionError, fetchError };
};

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { stepsByHour, caloriesByHour, totalSteps, totalCalories, permissions, permissionError, fetchError } = useHealthData(currentDate);

  const handleDateChange = (days) => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(prevDate.getDate() + days);
      return newDate;
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Datos del {currentDate.toDateString()}</Text>
      <Text style={styles.subtitle}>Pasos por Hora</Text>
      {Object.entries(stepsByHour).map(([hour, count]) => (
        <Text key={`steps-${hour}`}>{hour}:00 - {count} pasos</Text>
      ))}
      <Text style={styles.subtitle}>Calorías por Hora</Text>
      {Object.entries(caloriesByHour).map(([hour, count]) => (
        <Text key={`calories-${hour}`}>{hour}:00 - {count.toFixed(2)} kcal</Text>
      ))}
      <Text>Total Pasos: {totalSteps} pasos</Text>
      <Text>Total Calorías: {totalCalories.toFixed(2)} kcal</Text>
      <View style={styles.buttonContainer}>
        <Button title="Atras" onPress={() => handleDateChange(-1)} />
        <Button title="Adelante" onPress={() => handleDateChange(1)} />
      </View>
      <Text>Permisos: {permissions.map(p => p.recordType).join(', ')}</Text>
      {permissionError && <Text style={styles.error}>{permissionError}</Text>}
      {fetchError && <Text style={styles.error}>{fetchError}</Text>}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 16,
  },
  error: {
    color: 'red',
    marginTop: 10,
  },
});
