import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWorkoutHistory, useWorkout } from '../services/workoutLogService';
import { formatDate } from '../components/planner/format';

/**
 * Minutes between the start of a workout and its completion (or now if it is
 * still running). Dates arrive from the API as ISO strings, not Date objects,
 * so they are parsed defensively here.
 */
const elapsedMinutes = (startedAt: Date | string | undefined, completedAt?: Date | string | null): number => {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 60000));
};

const workoutDuration = (
  actualDuration: number | undefined,
  startedAt: Date | string | undefined,
  completedAt?: Date | string | null,
): number => actualDuration && actualDuration > 0
  ? actualDuration
  : elapsedMinutes(startedAt, completedAt);

const History: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: workoutLogs = [], isLoading, error } = useWorkoutHistory();
  const requestedWorkoutId = (location.state as { openWorkoutId?: string } | null)?.openWorkoutId ?? null;
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(requestedWorkoutId);

  // Fetch workout detail when selectedWorkoutId changes
  const { data: detailData } = useWorkout(selectedWorkoutId ?? '');

  const handleSelectWorkout = (workoutId: string) => {
    setSelectedWorkoutId(workoutId);
  };

  const handleCloseDetail = () => {
    setSelectedWorkoutId(null);
    navigate('/history', { replace: true, state: undefined });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading workout history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Error loading history: {error instanceof Error ? error.message : 'Unknown error'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (workoutLogs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-xl font-semibold text-gray-800">AI Workout Planner</h1>
                </div>
                <div className="hidden md:block">
                  <div className="ml-10 flex items-baseline space-x-4">
                    <a href="/dashboard" className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900">Dashboard</a>
                    <a href="/planner" className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900">Planner</a>
                    <a href="/analytics" className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900 analytics">Analytics</a>
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-500">Welcome, User</span>
                  <div className="ml-3 h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">U</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Workout History</h2>
              <p className="text-lg text-gray-600 mb-8">
                You haven't logged any workouts yet. Start your first workout from the Planner!
              </p>
              <div className="mt-6">
                <a href="/planner" className="af-btn-primary">
                  Go to Planner
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-semibold text-gray-800">AI Workout Planner</h1>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <a href="/dashboard" className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900">Dashboard</a>
                  <a href="/planner" className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900">Planner</a>
                  <a href="/analytics" className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900 analytics">Analytics</a>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-500">Welcome, User</span>
                <div className="ml-3 h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">U</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {/* Workout History Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Workout History</h2>
              <p className="text-lg text-gray-600 mb-8">
                Track your completed workouts and monitor your progress over time.
              </p>
            </div>

            {/* Workout Detail Panel */}
            {selectedWorkoutId && detailData && (
              <div className="mb-8">
                <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center" onClick={handleCloseDetail}>
                  <div className="relative z-50 bg-white rounded-lg w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-bold text-gray-800">Workout Details</h3>
                      <button
                        onClick={handleCloseDetail}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">Date:</span> {formatDate(detailData.workoutDate)}
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">Day:</span> {detailData.dayName.charAt(0).toUpperCase() + detailData.dayName.slice(1)}
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">Focus:</span> {detailData.focus}
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">Status:</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${detailData.status === 'completed' ? 'bg-green-100 text-green-800' : detailData.status === 'abandoned' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                          {detailData.status === 'completed' ? 'Completed' : detailData.status === 'abandoned' ? 'Abandoned' : 'In Progress'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">Planned Duration:</span> {detailData.plannedDuration} min
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">Actual Duration:</span> {workoutDuration(detailData.actualDuration, detailData.startedAt, detailData.completedAt)} min
                      </div>

                      {detailData.notes && (
                        <div className="mt-3">
                          <span className="block text-sm font-medium text-gray-700 mb-1">Notes:</span>
                          <p className="text-sm text-gray-600 italic">{detailData.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Exercise Comparison */}
                    <div className="mt-4">
                      <h4 className="text-lg font-bold text-gray-800 mb-3">Exercise Performance</h4>
                      {detailData.exercises.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exercise</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planned</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actual</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {detailData.exercises.map((exercise) => (
                                <tr key={exercise._id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{exercise.exerciseName}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {exercise.plannedSets !== undefined && exercise.plannedReps !== undefined ? (
                                      `${exercise.plannedSets}×${exercise.plannedReps}`
                                    ) : exercise.plannedDuration !== undefined ? (
                                      `${exercise.plannedDuration}s`
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {exercise.actualSets !== undefined && exercise.actualReps !== undefined ? (
                                      `${exercise.actualSets}×${exercise.actualReps}`
                                    ) : exercise.actualDuration !== undefined ? (
                                      `${exercise.actualDuration}s`
                                    ) : exercise.completed ? (
                                      'Completed'
                                    ) : exercise.skipped ? (
                                      'Skipped'
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <span className={`px-2 py-1 rounded-full text-xs ${exercise.completed ? 'bg-green-100 text-green-800' : exercise.skipped ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-500'}`}>
                                      {exercise.completed ? 'Completed' : exercise.skipped ? 'Skipped' : 'Pending'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{exercise.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-4">No exercises recorded for this workout.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Workout History List */}
            <div className="space-y-4">
              {workoutLogs.map((workout) => (
                <div
                  key={workout._id}
                  className={`p-4 border rounded-lg ${selectedWorkoutId === workout._id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} cursor-pointer hover:bg-gray-50`}
                  onClick={() => handleSelectWorkout(workout._id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{workout.dayName.charAt(0).toUpperCase() + workout.dayName.slice(1)} Workout</h3>
                      <p className="mt-1 text-sm text-gray-600">{workout.focus}</p>
                    </div>
                    <div className="text-right space-x-3">
                      <div className="text-sm text-gray-500">
                        {formatDate(workout.workoutDate)}
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs ${workout.status === 'completed' ? 'bg-green-100 text-green-800' : workout.status === 'abandoned' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                        {workout.status === 'completed' ? 'Completed' : workout.status === 'abandoned' ? 'Abandoned' : 'In Progress'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {workoutDuration(workout.actualDuration, workout.startedAt, workout.completedAt)} min
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      </div>
    );
  };

export default History;