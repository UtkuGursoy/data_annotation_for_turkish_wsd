import { useState } from 'react';

// Import from folders directly under /src
import ParticipantInfo from './components/ParticipantInfo/ParticipantInfo';
import Walkthrough from './components/Walkthrough/Walkthrough';
import AnnotationTask from './components/AnnotationTask/AnnotationTask';
import LastPage from './components/LastPage/LastPage';

function App() {
  const [step, setStep] = useState(1);
  const [participantData, setParticipantData] = useState({
    fullName: '',
    age: '',
    educationDegree: ''
  });
  const [startIndex, setStartIndex] = useState(0);
  const [orderedTasks, setOrderedTasks] = useState([]);

  const handleStart = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/init-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          participantName: participantData.fullName,
          age: participantData.age,
          educationDegree: participantData.educationDegree
        })
      });
      
      const data = await response.json();
      
      // Fetch tasks from the backend instead of local import
      const tasksResponse = await fetch('http://localhost:5000/api/tasks');
      const tasksData = await tasksResponse.json();
      const originalTasks = Object.values(tasksData);
      let tasksArray = originalTasks;

      if (data.shuffledWords) {
        tasksArray = [];
        for (const wordIdx of data.shuffledWords) {
          for (let i = 0; i < 6; i++) {
            const task = originalTasks[wordIdx * 6 + i];
            if (task) {
              tasksArray.push(task);
            }
          }
        }
      }
      
      // DEV ONLY: Shrink dataset to 3 items to test the finish flow easily
      //tasksArray = tasksArray.slice(0, 3);

      setOrderedTasks(tasksArray);

      let nextIndex = 0;
      
      if (data.lastSampleId !== undefined && data.lastSampleId !== null) {
        const lastIdx = tasksArray.findIndex(t => String(t.sample_id) === String(data.lastSampleId));
        if (lastIdx !== -1) {
          nextIndex = lastIdx + 1;
        }
      }
      
      if (nextIndex >= tasksArray.length) {
        setStep(4);
        return;
      }
      
      setStartIndex(nextIndex);
    } catch (error) {
      console.error("Failed to create or resume session file:", error);
    }
    setStep(3);
  };

  return (
    <div className="App">
      {step === 1 && (
        <ParticipantInfo 
          initialData={participantData}
          onNext={(data) => {
            setParticipantData(data);
            setStep(2);
          }} 
        />
      )}

      {step === 2 && (
        <Walkthrough 
          onStart={handleStart} 
          onBack={() => setStep(1)} 
        />
      )}

      {step === 3 && (
        <AnnotationTask 
          tasks={orderedTasks}
          participantData={participantData}
          initialIndex={startIndex}
          onBack={() => setStep(2)}
          onFinish={(results) => {
            console.log("Final Results:", results);
            setStep(4);
          }}
        />
      )}

      {step === 4 && (
        <LastPage totalTasks={orderedTasks.length} />
      )}
    </div>
  );
}

export default App;