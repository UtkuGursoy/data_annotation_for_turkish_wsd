import { useState, useRef, useEffect } from 'react';
import './AnnotationTask.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://data-annotation-for-turkish-wsd.onrender.com';

// Helper function to highlight the Turkish homonym along with any attached suffixes
const renderHighlightedSentence = (sentence, homonym) => {
  if (!sentence || !homonym) return sentence;

  let lowerHomonym = homonym.toLocaleLowerCase('tr-TR');

  // Remove infinitive suffix for verbs (-mak / -mek) to use the root for matching
  if (lowerHomonym.endsWith('mak') || lowerHomonym.endsWith('mek')) {
    lowerHomonym = lowerHomonym.slice(0, -3);
  }

  let basePattern = lowerHomonym;

  // Handle special case for "nefis" (Ünlü düşmesi -> nefs)
  if (lowerHomonym === 'nefis') {
    basePattern = 'nefi?s';
  }
  // Account for Turkish consonant softening (Ünsüz Yumuşaması) at the root's end
  else if (lowerHomonym.endsWith('p')) {
    basePattern = lowerHomonym.slice(0, -1) + '[pb]';
  } else if (lowerHomonym.endsWith('ç')) {
    basePattern = lowerHomonym.slice(0, -1) + '[çc]';
  } else if (lowerHomonym.endsWith('t')) {
    basePattern = lowerHomonym.slice(0, -1) + '[td]';
  } else if (lowerHomonym.endsWith('k')) {
    basePattern = lowerHomonym.slice(0, -1) + '[kğg]';
  }
 
  // Handle Turkish case-insensitive matching for "i/İ" and "ı/I"
  basePattern = basePattern.replace(/i/g, '[iİ]').replace(/ı/g, '[ıI]');

  // Regex explanation:
  // (^|[^\p{L}]) - Group 1: Matches the start of the string or any non-letter (spaces, punctuation)
  // (basePattern\p{L}*) - Group 2: Matches the homonym root + any following Unicode letters (suffixes)
  const regex = new RegExp(`(^|[^\\p{L}])(${basePattern}\\p{L}*)`, 'gui');
  const parts = sentence.split(regex);

  let hasHighlighted = false;

  return parts.map((part, index) => {
    // Because we have 2 capture groups, 'split' returns elements in chunks of 3:
    // [0] = non-matched text, [1] = preceding space/punctuation, [2] = the matched word
    if (index % 3 === 2) {
      if (!hasHighlighted) {
        hasHighlighted = true;
        return <u key={index} style={{ textUnderlineOffset: '3px', textDecorationThickness: '2px', textDecorationSkipInk: 'none' }}>{part}</u>;
      }
      return part; // Return as plain text if we already highlighted a word
    }
    return part;
  });
};


const AnnotationTask = ({ tasks, participantData, onFinish, onBack, initialIndex = 0 }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [answers, setAnswers] = useState({}); // Stores { [sample_id]: { rating, neverSeen, nonsense } }
  const [isSaving, setIsSaving] = useState(false);
  const [hoveredRating, setHoveredRating] = useState({ sampleId: null, value: null });

  // Tooltip states
  const [showTooltipNeverSeen, setShowTooltipNeverSeen] = useState(false);
  const [hoveredNonsenseId, setHoveredNonsenseId] = useState(null); 
  const [showTooltipMeaning, setShowTooltipMeaning] = useState(false);
  
  const hoverTimeoutRefNeverSeen = useRef(null);
  const hoverTimeoutRefNonsense = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(hoverTimeoutRefNeverSeen.current);
      clearTimeout(hoverTimeoutRefNonsense.current);
    };
  }, []);

  // Group the tasks (Base, Left Ending, Right Ending)
  const baseTask = tasks[currentIndex];
  const leftTask = tasks[currentIndex + 1];
  const rightTask = tasks[currentIndex + 2];

  if (!baseTask) return null;

  // Retrieve current ratings
  const baseRating = answers[baseTask.sample_id]?.rating;
  const leftRating = answers[leftTask?.sample_id]?.rating;
  const rightRating = answers[rightTask?.sample_id]?.rating;

  // Retrieve checkbox states
  const currentNeverSeen = !!answers[baseTask.sample_id]?.neverSeen;

  // Lock and visibility logic
  const isBaseDone = baseRating !== undefined;
  const isLeftDone = leftRating !== undefined;
  const isRightDone = rightRating !== undefined;
  
  const isGroupAnswered = isBaseDone && isLeftDone && isRightDone;

  
  const handleRating = (value, sampleId) => {
    setAnswers(prev => ({
      ...prev,
      [sampleId]: { ...prev[sampleId], rating: value }
    }));
  };

  const handleNeverSeen = (checked) => {
    setAnswers(prev => ({
      ...prev,
      [baseTask.sample_id]: { ...prev[baseTask.sample_id], neverSeen: checked }
    }));
  };

  const handleNonsense = (checked, sampleId) => {
    setAnswers(prev => ({
      ...prev,
      [sampleId]: { ...prev[sampleId], nonsense: checked }
    }));
  };

  const handleNext = async () => {
    setIsSaving(true);
    
    const tasksToSave = [baseTask, leftTask, rightTask].filter(Boolean);
    const timestamp = new Date().toISOString();
    
    try {
      for (const task of tasksToSave) {
        const dataToSave = {
          participantName: participantData?.fullName || "Anonymous",
          sample_id: task.sample_id,
          rating: answers[task.sample_id]?.rating,
          neverSeen: currentNeverSeen, 
          nonsense: !!answers[task.sample_id]?.nonsense, 
          timestamp: timestamp
        };

        await fetch(`${API_URL}/api/save-annotation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave)
        });
      }
    } catch (error) {
      console.error("Failed to save annotation:", error);
    }
    
    setIsSaving(false);

    if (currentIndex + 3 < tasks.length) {
      setCurrentIndex(currentIndex + 3);
      window.scrollTo(0, 0);
    } else {
      onFinish(answers);
    }
  };

  const handleBack = () => {
    if (currentIndex === initialIndex) {
      onBack();
    } else {
      setCurrentIndex(currentIndex - 3);
    }
  };

  // Tooltip Handlers
  const handleMouseEnterNeverSeen = () => {
    hoverTimeoutRefNeverSeen.current = setTimeout(() => setShowTooltipNeverSeen(true), 1000);
  };
  const handleMouseLeaveNeverSeen = () => {
    clearTimeout(hoverTimeoutRefNeverSeen.current);
    setShowTooltipNeverSeen(false);
  };

  const handleMouseEnterNonsense = (sampleId) => {
    hoverTimeoutRefNonsense.current = setTimeout(() => setHoveredNonsenseId(sampleId), 1000);
  };
  const handleMouseLeaveNonsense = () => {
    clearTimeout(hoverTimeoutRefNonsense.current);
    setHoveredNonsenseId(null);
  };

  const totalGroups = Math.ceil(tasks.length / 3);
  const currentGroupNum = Math.floor(currentIndex / 3);
  const scenarioTextKey = `${baseTask.precontext} ${baseTask.sentence}`;

  return (
    <div className="task-page-container">
      {/* Homonym Word Display */}
      <div className="homonym-box">
        <p>Homonym Word: <strong>"<span key={`word-${baseTask.homonym}`} className="fade-in-content">{baseTask.homonym}</span>"</strong></p>
      </div>

      {/* Scenario Section */}
      <div className="scenario-section">
        <div className="scenario-label"><strong>Scenario:</strong></div>
        <div className="text-left">
          <p>
            <span key={scenarioTextKey} className="fade-in-content">
              {baseTask.precontext} {renderHighlightedSentence(baseTask.sentence, baseTask.homonym)}
            </span>
          </p>
        </div>
      </div>

      {/* 4 Column Layout */}
      <div className="four-column-layout">
        
        {/* Column 1: Meanings & Never Seen Checkbox */}
        <div className="meanings-col">
          <div>
            <div 
              className="meaning-row"
              style={{ position: 'relative' }}
              onMouseEnter={() => setShowTooltipMeaning(true)}
              onMouseLeave={() => setShowTooltipMeaning(false)}
            >
              {showTooltipMeaning && baseTask.example_sentence && (
                <div 
                  className="never-seen-tooltip meaning-tooltip" 
                  style={{ 
                    bottom: '100%', 
                    left: '-25%', 
                    top: 'auto', 
                    transform: 'none', 
                    marginBottom: '10px', 
                    width: 'max-content', 
                    maxWidth: '100%', 
                    whiteSpace: 'normal', 
                    zIndex: 10,
                    textAlign: 'left'
                  }}
                >
                  <strong>Example:</strong> {baseTask.example_sentence}
                </div>
              )}
              <p>
                <strong>Meaning:</strong><br/>
                <em key={`meanings-${baseTask.sample_id}`} className="fade-in-content" style={{ display: 'inline-block' }}>
                  {baseTask.judged_meaning}
                </em>
              </p>
            </div>
          </div>
          
          <div 
            className="never-seen-box" 
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '30px', position: 'relative' }}
            onMouseEnter={handleMouseEnterNeverSeen} 
            onMouseLeave={handleMouseLeaveNeverSeen}
          >
            {showTooltipNeverSeen && (
              <div className="never-seen-tooltip" style={{ top: '50%', left: '100%', bottom: 'auto', transform: 'translateY(-50%)', marginLeft: '15px' }}>
                Please make your choice anyways.
              </div>
            )}
            <label htmlFor="never-seen-check" style={{ marginBottom: '2px', cursor: 'pointer', fontWeight: '500' }}>
              I have never seen this meaning:
            </label>
            <input 
              type="checkbox" 
              id="never-seen-check"
              checked={currentNeverSeen}
              onChange={(e) => handleNeverSeen(e.target.checked)}
              style={{ cursor: 'pointer', transform: 'scale(1.2)' }} 
            />
          </div>
        </div>

        {/* Column 2: Bottom-Left Arrow, Slidebar, Ending, Nonsense Checkbox */}
        <div className="evaluation-col">
          {isBaseDone && leftTask && (
            <div key={`col2-${leftTask.sample_id}`} className="fade-in-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="arrow-down">&#8601;</div>
              <div className="ending-text" style={{ width: '100%' }}>
                <p><strong>Ending:</strong> <span>{leftTask.ending}</span></p>
              </div>
              <div className="slidebar-container">
                <div className="slidebar" onMouseLeave={() => setHoveredRating({ sampleId: null, value: null })} style={{ opacity: isLeftDone ? 0.6 : 1 }}>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <div 
                      key={num}
                      className="slidebar-slot"
                      onClick={() => !isLeftDone && handleRating(num, leftTask.sample_id)}
                      onMouseEnter={() => !isLeftDone && setHoveredRating({ sampleId: leftTask.sample_id, value: num })}
                      style={{
                        cursor: isLeftDone ? 'default' : 'pointer',
                        backgroundColor: isLeftDone ? (num <= leftRating ? '#8eb8eb' : '#f8f9fa') : (hoveredRating.sampleId === leftTask.sample_id ? (num <= hoveredRating.value ? '#0056b3' : '#fff') : (num <= (leftRating || 0) ? '#007bff' : '#fff')),
                        color: isLeftDone ? (num <= leftRating ? '#fff' : '#adb5bd') : (hoveredRating.sampleId === leftTask.sample_id ? (num <= hoveredRating.value ? '#fff' : '#333') : (num <= (leftRating || 0) ? '#fff' : '#333'))
                      }}
                    ></div>
                  ))}
                </div>
              </div>
              
              <div 
                className="nonsense-box" 
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '25px', position: 'relative' }}
                onMouseEnter={() => handleMouseEnterNonsense(leftTask.sample_id)} 
                onMouseLeave={handleMouseLeaveNonsense}
              >
                {hoveredNonsenseId === leftTask.sample_id && (
                  <div className="never-seen-tooltip" style={{ top: '50%', left: '100%', bottom: 'auto', transform: 'translateY(-50%)', marginLeft: '15px' }}>
                    Please make your choice anyways.
                  </div>
                )}
                <label htmlFor={`nonsense-${leftTask.sample_id}`} style={{ marginBottom: '2px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  This usage makes no sense:
                </label>
                <input 
                  type="checkbox" 
                  id={`nonsense-${leftTask.sample_id}`}
                  checked={!!answers[leftTask.sample_id]?.nonsense}
                  onChange={(e) => handleNonsense(e.target.checked, leftTask.sample_id)}
                  style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Downward Arrow, Slidebar, Nonsense Checkbox */}
        <div className="evaluation-col">
          <div key={`col3-${baseTask.sample_id}`} className="fade-in-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="arrow-down" style={{ transform: 'scale(1.3,6)', margin: '65px 0 125px 0' }}>&#8595;</div>
            <div className="slidebar-container">
              <div className="slidebar" onMouseLeave={() => setHoveredRating({ sampleId: null, value: null })} style={{ opacity: isBaseDone ? 0.6 : 1 }}>
                {[1, 2, 3, 4, 5].map((num) => (
                  <div 
                    key={num}
                    className="slidebar-slot"
                    onClick={() => !isBaseDone && handleRating(num, baseTask.sample_id)}
                    onMouseEnter={() => !isBaseDone && setHoveredRating({ sampleId: baseTask.sample_id, value: num })}
                    style={{
                      cursor: isBaseDone ? 'default' : 'pointer',
                      backgroundColor: isBaseDone ? (num <= baseRating ? '#8eb8eb' : '#f8f9fa') : (hoveredRating.sampleId === baseTask.sample_id ? (num <= hoveredRating.value ? '#0056b3' : '#fff') : (num <= (baseRating || 0) ? '#007bff' : '#fff')),
                      color: isBaseDone ? (num <= baseRating ? '#fff' : '#adb5bd') : (hoveredRating.sampleId === baseTask.sample_id ? (num <= hoveredRating.value ? '#fff' : '#333') : (num <= (baseRating || 0) ? '#fff' : '#333'))
                    }}
                  ></div>
                ))}
              </div>
            </div>

            <div 
              className="nonsense-box" 
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '25px', position: 'relative' }}
              onMouseEnter={() => handleMouseEnterNonsense(baseTask.sample_id)} 
              onMouseLeave={handleMouseLeaveNonsense}
            >
              {hoveredNonsenseId === baseTask.sample_id && (
                <div className="never-seen-tooltip" style={{ top: '50%', left: '100%', bottom: 'auto', transform: 'translateY(-50%)', marginLeft: '15px' }}>
                    Please make your choice anyways.
                  </div>
              )}
              <label htmlFor={`nonsense-${baseTask.sample_id}`} style={{ marginBottom: '2px', cursor: 'pointer', fontSize: '0.85rem' }}>
                This usage makes no sense:
              </label>
              <input 
                type="checkbox" 
                id={`nonsense-${baseTask.sample_id}`}
                checked={!!answers[baseTask.sample_id]?.nonsense}
                onChange={(e) => handleNonsense(e.target.checked, baseTask.sample_id)}
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
            </div>
          </div>
        </div>

        {/* Column 4: Bottom-Right Arrow, Slidebar, Ending, Nonsense Checkbox */}
        <div className="evaluation-col">
          {isLeftDone && rightTask && (
            <div key={`col4-${rightTask.sample_id}`} className="fade-in-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="arrow-down">&#8600;</div> 
              <div className="ending-text" style={{ width: '100%' }}>
                <p><strong>Ending:</strong> <span>{rightTask.ending}</span></p>
              </div>
              <div className="slidebar-container">
                <div className="slidebar" onMouseLeave={() => setHoveredRating({ sampleId: null, value: null })} style={{ opacity: isRightDone ? 0.6 : 1 }}>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <div 
                      key={num}
                      className="slidebar-slot"
                      onClick={() => !isRightDone && handleRating(num, rightTask.sample_id)}
                      onMouseEnter={() => !isRightDone && setHoveredRating({ sampleId: rightTask.sample_id, value: num })}
                      style={{
                        cursor: isRightDone ? 'default' : 'pointer',
                        backgroundColor: isRightDone ? (num <= rightRating ? '#8eb8eb' : '#f8f9fa') : (hoveredRating.sampleId === rightTask.sample_id ? (num <= hoveredRating.value ? '#0056b3' : '#fff') : (num <= (rightRating || 0) ? '#007bff' : '#fff')),
                        color: isRightDone ? (num <= rightRating ? '#fff' : '#adb5bd') : (hoveredRating.sampleId === rightTask.sample_id ? (num <= hoveredRating.value ? '#fff' : '#333') : (num <= (rightRating || 0) ? '#fff' : '#333'))
                      }}
                    ></div>
                  ))}
                </div>
              </div>

              <div 
                className="nonsense-box" 
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '25px', position: 'relative' }}
                onMouseEnter={() => handleMouseEnterNonsense(rightTask.sample_id)} 
                onMouseLeave={handleMouseLeaveNonsense}
              >
                {hoveredNonsenseId === rightTask.sample_id && (
                 <div 
                    className="never-seen-tooltip tooltip-left" 
                    style={{ 
                      top: '50%', 
                      right: '100%', /* Pushes it to the left side */
                      left: 'auto', 
                      bottom: 'auto', 
                      transform: 'translateY(-50%)', 
                      marginRight: '15px', /* Spacing on the right side instead of left */
                      animation: 'fadeInTooltipLeft 0.2s ease-in-out forwards' /* Uses the new animation */
                    }}
                  >
                    Please make your choice anyways.
                  </div>
                )}
                <label htmlFor={`nonsense-${rightTask.sample_id}`} style={{ marginBottom: '2px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  This usage makes no sense:
                </label>
                <input 
                  type="checkbox" 
                  id={`nonsense-${rightTask.sample_id}`}
                  checked={!!answers[rightTask.sample_id]?.nonsense}
                  onChange={(e) => handleNonsense(e.target.checked, rightTask.sample_id)}
                  style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-wrapper">
        <div 
          className="progress-fill" 
          style={{ width: `${(currentGroupNum / totalGroups) * 100}%` }}
        />
        <span className="progress-text">Progress: {currentGroupNum} / {totalGroups}</span>
      </div>

      {/* Footer Buttons */}
      <div className="button-footer">
        <button className="back-button" onClick={handleBack} disabled={isSaving}>Back</button>
        <button 
          className="next-button" 
          onClick={handleNext} 
          disabled={!isGroupAnswered || isSaving}
        >
          {isSaving ? 'Saving...' : (currentIndex + 3 >= tasks.length ? 'Finish' : 'Next')}
        </button>
      </div>
    </div>
  );
};

export default AnnotationTask;