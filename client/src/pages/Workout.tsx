import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlan } from '../services/planService';
import { useActiveWorkout, useWorkout, useStartWorkout, useUpdateWorkout, useCompleteWorkout, useAbandonWorkout } from '../services/workoutLogService';
import type { WorkoutExerciseLog } from '../types/workoutLog';

const Workout: React.FC = () => {
  const { planId, dayIndex } = useParams<{ planId: string; dayIndex: string }>();
  const navigate = useNavigate();

  const parsedDayIndex =
    dayIndex !== undefined && dayIndex !== '' && !Number.isNaN(Number(dayIndex))
      ? Number(dayIndex)
      : null;
  const { data: plan, isLoading: planLoading, error: planError } = usePlan(planId);
  const {
    data: activeWorkout,
    isLoading: activeWorkoutLoading,
    error: activeWorkoutError,
    refetch: refetchActiveWorkout,
  } = useActiveWorkout(planId ?? '', parsedDayIndex ?? -1);

  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const currentWorkoutId = workoutId ?? activeWorkout?._id ?? '';
  const { data: workout, isLoading: workoutLoading, error: workoutError } = useWorkout(currentWorkoutId);
  const { mutateAsync: startWorkout, isPending: isStarting } = useStartWorkout();
  const { mutateAsync: updateWorkout, isPending: isUpdating } = useUpdateWorkout();
  const { mutateAsync: completeWorkout, isPending: isCompleting } = useCompleteWorkout();
  const { mutateAsync: abandonWorkout, isPending: isAbandoning } = useAbandonWorkout();

  // Local copies of the values being typed. These inputs used to bind directly
  // to the server-backed query cache; whenever the cache refreshed with older
  // data mid-typing (e.g. a slow GET resolving after a save), React re-rendered
  // the field back to that older value and characters were dropped ("12" saved
  // as "2", "good" saved as "gd"). The local value is authoritative while the
  // user is typing; every save handler merges it into the payload so MongoDB
  // always gets exactly what was typed.
  const [entrySetReps, setEntrySetReps] = useState<Record<string, number>>({});
  const [entryReps, setEntryReps] = useState<Record<number, number>>({});
  const [entrySeconds, setEntrySeconds] = useState<Record<number, number>>({});
  const [entryNotes, setEntryNotes] = useState<Record<number, string>>({});
  useEffect(() => {
    setEntrySetReps({});
    setEntryReps({});
    setEntrySeconds({});
    setEntryNotes({});
  }, [workout?._id]);

  // Merge the locally typed values over a snapshot of the exercises before any
  // save, so a stale query cache can never overwrite what the user typed.
  const withEntries = (list: WorkoutExerciseLog[]): WorkoutExerciseLog[] =>
    list.map((ex, idx) => ({
      ...ex,
      ...(entryReps[idx] !== undefined ? { actualReps: entryReps[idx] } : {}),
      ...(entrySeconds[idx] !== undefined ? { actualDuration: entrySeconds[idx] } : {}),
      ...(entryNotes[idx] !== undefined ? { notes: entryNotes[idx] } : {}),
    }));

  // The saved start time keeps the display correct when an active log is resumed.
  useEffect(() => {
    if (workout?.status !== 'in_progress') return;
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [workout?._id, workout?.status]);

  const startedAt = workout ? new Date(workout.startedAt).getTime() : Number.NaN;
  const elapsedSeconds = Number.isNaN(startedAt)
    ? 0
    : Math.max(0, Math.floor((clockNow - startedAt) / 1000));

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle exercise selection
  const selectExercise = (index: number) => {
    setActiveExerciseIndex(index);
  };

  // Handle exercise completion
  const completeExercise = async (exerciseIndex: number) => {
    if (!workout) return;

    const updatedExercises = withEntries([...workout.exercises]);
    const exercise = updatedExercises[exerciseIndex];
    
    updatedExercises[exerciseIndex] = {
      ...exercise,
      completed: true,
      skipped: false,
    };

    try {
      await updateWorkout({
        id: workout._id,
        updates: { exercises: updatedExercises }
      });
      setProgressError(null);
    } catch {
      setProgressError('Could not save this exercise. Please try again.');
    }
  };

  // Handle set completion (for rep-based exercises)
  const completeSet = async (exerciseIndex: number, setNumber: number, actualReps: number) => {
    if (!workout) return;

    const updatedExercises = withEntries([...workout.exercises]);
    const exercise = updatedExercises[exerciseIndex];
    
    // For rep-based exercises, track the last set's reps
    const updatedExercise = {
      ...exercise,
      actualSets: Math.max(exercise.actualSets || 0, setNumber),
      actualReps: actualReps // Store the last set's reps
    };

    updatedExercises[exerciseIndex] = updatedExercise;

    try {
      await updateWorkout({
        id: workout._id,
        updates: { exercises: updatedExercises }
      });
      setProgressError(null);
    } catch {
      setProgressError('Could not save your performance. Please try again.');
    }
  };

  // Handle duration-based exercise completion
  const completeDurationExercise = async (exerciseIndex: number, actualDuration: number) => {
    if (!workout) return;

    const updatedExercises = withEntries([...workout.exercises]);
    const exercise = updatedExercises[exerciseIndex];
    
    const updatedExercise = {
      ...exercise,
      actualDuration: actualDuration
    };

    updatedExercises[exerciseIndex] = updatedExercise;

    try {
      await updateWorkout({
        id: workout._id,
        updates: { exercises: updatedExercises }
      });
      setProgressError(null);
    } catch {
      setProgressError('Could not save your performance. Please try again.');
    }
  };

  // Handle skipping an exercise
  const skipExercise = async (exerciseIndex: number) => {
    if (!workout) return;

    const updatedExercises = withEntries([...workout.exercises]);
    const exercise = updatedExercises[exerciseIndex];
    
    updatedExercises[exerciseIndex] = {
      ...exercise,
      completed: false,
      skipped: true
    };

    try {
      await updateWorkout({
        id: workout._id,
        updates: { exercises: updatedExercises }
      });
      setProgressError(null);
    } catch {
      setProgressError('Could not save this exercise. Please try again.');
    }
  };

  // Handle workout completion
  const handleCompleteWorkout = async () => {
    if (!workout) return;

    try {
      await completeWorkout(workout._id);
      navigate('/history');
    } catch {
      setProgressError('Could not complete the workout. Please try again.');
    }
  };

  // Handle workout abandonment
  const handleAbandonWorkout = async () => {
    if (!workout) return;

    if (window.confirm('Are you sure you want to abandon this workout? Your progress will be saved.')) {
      try {
        await abandonWorkout(workout._id);
        navigate('/planner');
      } catch {
        setProgressError('Could not abandon the workout. Please try again.');
      }
    }
  };

  // Handle starting a new workout
  const handleStartWorkout = async () => {
    if (!planId || parsedDayIndex === null) return;

    try {
      const newWorkout = await startWorkout({ planId, dayIndex: parsedDayIndex });
      // Store the created workout log id so the query can load it.
      setWorkoutId(newWorkout._id);
    } catch (err) {
      const { data: existingWorkout } = await refetchActiveWorkout();
      if (existingWorkout) {
        setWorkoutId(existingWorkout._id);
        return;
      }
      setStartError(err instanceof Error ? err.message : 'Failed to start workout. Please try again.');
    }
  };

  // Missing/invalid route params → send the user back to the planner.
  // (Navigation happens in an effect — never during render.)
  const missingParams =
    !planId ||
    parsedDayIndex === null ||
    !Number.isInteger(parsedDayIndex) ||
    parsedDayIndex < 0 ||
    parsedDayIndex > 6;

  useEffect(() => {
    if (missingParams) navigate('/planner');
  }, [missingParams, navigate]);

  if (missingParams) {
    return null;
  }

  // If we're loading the workout or profile, show loading state
  if (workoutLoading || (!workout && (planLoading || activeWorkoutLoading))) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading workout...</p>
        </div>
      </div>
    );
  }

  // If there's an error, show error message
  if (workoutError || (!workout && (planError || activeWorkoutError))) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">
            Error loading workout: {(workoutError ?? planError ?? activeWorkoutError)?.message}
          </p>
          <button 
            onClick={() => navigate('/planner')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Planner
          </button>
        </div>
      </div>
    );
  }

  const plannedDay = plan?.days.find((day) => day.dayIndex === parsedDayIndex);

  // A planned day can be inspected without creating a WorkoutLog.
  if (!workout) {
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
                  <span className="text-sm font-medium text-gray-500">Welcome, {'User'}</span>
                  <div className="ml-3 h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">{'U'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">View Workout</h2>
              {plannedDay ? (
                <>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {plannedDay.dayName.charAt(0).toUpperCase() + plannedDay.dayName.slice(1)}
                    {' · '}{plannedDay.focus}
                  </h3>
                  <p className="mt-2 mb-6 text-sm text-gray-600">
                    Planned duration: {plannedDay.estimatedDuration} min
                  </p>
                  <ul className="mb-8 space-y-3">
                    {plannedDay.exercises.map((exercise, index) => (
                      <li key={`${exercise.name}-${index}`} className="rounded border border-gray-200 bg-white p-4">
                        <p className="font-medium text-gray-900">{exercise.name}</p>
                        <p className="mt-1 text-sm text-gray-600">
                          {exercise.sets !== undefined && exercise.reps !== undefined
                            ? `${exercise.sets} sets × ${exercise.reps} reps`
                            : exercise.durationSeconds !== undefined
                              ? `${exercise.durationSeconds} seconds`
                              : 'See exercise instructions'}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">{exercise.instructions}</p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mb-8 text-gray-600">This workout day is not available in the selected plan.</p>
              )}
              {startError && (
                <p className="mb-4 text-sm text-red-600" role="alert">{startError}</p>
              )}
              {plannedDay && !plannedDay.restDay && (
              <button 
                onClick={handleStartWorkout}
                disabled={isStarting}
                className="w-full af-btn-primary disabled:opacity-50"
              >
                {isStarting ? 'Starting...' : 'Start Workout'}
              </button>
              )}
              <button
                onClick={() => navigate(`/planner/${planId}`)}
                className="mt-3 w-full af-btn-secondary"
              >
                Back to Plan
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // While the started workout is still being fetched, keep showing the loader.
  if (!workout) {
    return null;
  }

  // If we have a workout, show the workout interface
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
                <span className="text-sm font-medium text-gray-500">Welcome, {'User'}</span>
                <div className="ml-3 h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">{'U'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {/* Workout Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">{workout.dayName.charAt(0).toUpperCase() + workout.dayName.slice(1)} Workout</h2>
              <p className="mt-2 text-sm text-gray-600">{workout.focus}</p>
              <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500">
                <span>Planned: {workout.plannedDuration} min</span>
                <span>Actual: {formatTime(elapsedSeconds)}</span>
                <span>Status: {workout.status === 'in_progress' ? 'In Progress' : workout.status === 'completed' ? 'Completed' : 'Abandoned'}</span>
              </div>
              {workout.status === 'in_progress' && (
                <p role="status" className="mt-2 text-sm font-semibold text-blue-700">Workout in progress</p>
              )}
              {progressError && <p role="alert" className="mt-2 text-sm text-red-600">{progressError}</p>}
            </div>

            {/* Timer Display */}
            <div className="mb-6 text-center">
              <div className="text-4xl font-bold text-gray-800">{formatTime(elapsedSeconds)}</div>
            </div>

            {/* Exercises List */}
            {workout.exercises.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Exercises</h3>
                {workout.exercises.map((exercise, index) => {
                  const isActive = activeExerciseIndex === index;
                  const isCompleted = exercise.completed;
                  const isSkipped = exercise.skipped;
                  const repSets = exercise.plannedSets ?? 0;
                  const repReps = exercise.plannedReps ?? 0;
                  const durSeconds = exercise.plannedDuration ?? 0;
                  
                  return (
                    <div 
                      key={exercise._id}
                      className={`p-4 border rounded-lg ${isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} ${isCompleted ? 'border-green-500 bg-green-50' : ''} ${isSkipped ? 'border-yellow-500 bg-yellow-50' : ''} cursor-pointer hover:bg-gray-50`}
                      onClick={() => !isCompleted && !isSkipped && selectExercise(index)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium text-gray-900">{exercise.exerciseName}</div>
                        <div className="text-sm text-gray-600">
                          {isCompleted ? 'Completed' : isSkipped ? 'Skipped' : isActive ? 'Active' : ''}
                        </div>
                      </div>
                      
                      {/* Planned vs Actual */}
                      <div className="text-sm text-gray-500 mb-2">
                        <div className="flex space-x-4">
                          <div className="flex-1">
                            <span className="font-medium">Planned:</span>
                            {exercise.plannedSets !== undefined && exercise.plannedReps !== undefined ? (
                              `${exercise.plannedSets} sets × ${exercise.plannedReps} reps`
                            ) : exercise.plannedDuration !== undefined ? (
                              `${exercise.plannedDuration}s`
                            ) : (
                              '-'
                            )}
                          </div>
                          <div className="flex-1 text-right">
                            <span className="font-medium">Actual:</span>
                            {exercise.actualSets !== undefined && exercise.actualReps !== undefined ? (
                              `${exercise.actualSets} sets × ${exercise.actualReps} reps`
                            ) : exercise.actualDuration !== undefined ? (
                              `${exercise.actualDuration}s`
                            ) : (
                              '-'
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Exercise Input Controls (only for active exercise) */}
                      {isActive && !isCompleted && !isSkipped && (
                        <div className="mt-4 p-3 bg-gray-50 rounded">
                          <h4 className="font-medium text-gray-900 mb-2">Log Your Performance</h4>
                          <p className="mb-3 text-xs text-gray-500">Performance and notes save as you enter them.</p>
                          
                          {/* Rep-based exercise */}
                          {exercise.plannedSets !== undefined && exercise.plannedReps !== undefined && (
                            <div className="space-y-3">
                              <p className="text-sm font-medium text-gray-700">Sets:</p>
                              <div className="grid grid-cols-2 gap-2">
                                {Array.from({ length: repSets }, (_, i) => i + 1).map(setNum => (
                                  <div key={setNum} className="flex flex-col items-center">
                                    <label className="text-xs text-gray-600 mb-1">Set {setNum}</label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={repReps * 2} // Allow up to 2x planned reps
                                      value={
                                        entrySetReps[`${index}:${setNum}`] !== undefined
                                          ? entrySetReps[`${index}:${setNum}`]
                                          : exercise.actualSets && exercise.actualSets >= setNum
                                            ? (exercise.actualReps || 0)
                                            : 0
                                      }
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 0;
                                        setEntrySetReps((prev) => ({ ...prev, [`${index}:${setNum}`]: value }));
                                        setEntryReps((prev) => ({ ...prev, [index]: value }));
                                        completeSet(index, setNum, value);
                                      }}
                                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                                      placeholder="Reps"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Duration-based exercise */}
                          {exercise.plannedDuration !== undefined && (
                            <div className="space-y-3">
                              <p className="text-sm font-medium text-gray-700">Duration (seconds):</p>
                              <input
                                type="number"
                                min={0}
                                max={durSeconds * 2} // Allow up to 2x planned duration
                                value={entrySeconds[index] !== undefined ? entrySeconds[index] : (exercise.actualDuration || 0)}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  setEntrySeconds((prev) => ({ ...prev, [index]: value }));
                                  completeDurationExercise(index, value);
                                }}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Seconds"
                              />
                            </div>
                          )}
                          
                          {/* Notes */}
                          <div className="mt-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                            <textarea
                              value={entryNotes[index] !== undefined ? entryNotes[index] : (exercise.notes || '')}
                              onChange={(e) => {
                                if (!workout) return;
                                const value = e.target.value;
                                setEntryNotes((prev) => ({ ...prev, [index]: value }));
                                const updatedExercises = withEntries([...workout.exercises]);
                                updatedExercises[index] = {
                                  ...updatedExercises[index],
                                  notes: value
                                };
                                updateWorkout({
                                  id: workout._id,
                                  updates: { exercises: updatedExercises }
                                }).then(() => setProgressError(null)).catch(() => {
                                  setProgressError('Could not save your notes. Please try again.');
                                });
                              }}
                              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              rows={2}
                              placeholder="Add any notes about this exercise..."
                            />
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="mt-4 flex flex-col sm:flex-row sm:space-x-2">
                            <button
                              onClick={() => completeExercise(index)}
                              disabled={isUpdating}
                              className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-md disabled:opacity-50 hover:bg-green-700"
                            >
                              {isUpdating ? 'Saving...' : 'Mark Exercise Done'}
                            </button>
                            <button
                              onClick={() => skipExercise(index)}
                              disabled={isUpdating}
                              className="w-full sm:w-auto mt-2 sm:mt-0 px-4 py-2 bg-yellow-600 text-white rounded-md disabled:opacity-50 hover:bg-yellow-700"
                            >
                              Skip Exercise
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No exercises found for this workout.</p>
            )}

            {/* Workout Actions */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              {workout.status === 'in_progress' && (
                <div className="flex flex-col sm:flex-row sm:space-x-3">
                  <button
                    onClick={handleCompleteWorkout}
                    disabled={isCompleting || isAbandoning}
                    className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-md disabled:opacity-50 hover:bg-green-700"
                  >
                    {isCompleting ? 'Completing...' : 'Complete Workout'}
                  </button>
                  <button
                    onClick={handleAbandonWorkout}
                    disabled={isAbandoning || isCompleting}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-600 text-white rounded-md disabled:opacity-50 hover:bg-gray-700"
                  >
                    {isAbandoning ? 'Abandoning...' : 'Abandon Workout'}
                  </button>
                </div>
              )}
              
              {workout.status !== 'in_progress' && (
                <div className="flex flex-col sm:flex-row sm:space-x-3">
                  <button
                    onClick={() => navigate('/history')}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    View History
                  </button>
                  <button
                    onClick={() => navigate(`/planner/${workout.planId}`)}
                    className="w-full sm:w-auto mt-2 sm:mt-0 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Back to Planner
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Workout;