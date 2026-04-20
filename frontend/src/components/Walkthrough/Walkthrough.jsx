import { useState, useEffect } from 'react';
import './Walkthrough.css';    

const Walkthrough = ({ onStart, onBack, isStarting }) => {
  const [messageIndex, setMessageIndex] = useState(0);

  const loadingMessages = [
    "Please wait, data samples are being prepared...",
    "Be patient, this could take a couple of seconds...",
    "Setting up your annotation suite...",
    "Almost ready..."
  ];

  useEffect(() => {
    let interval;
    if (isStarting) {
      interval = setInterval(() => {
        setMessageIndex((prevIndex) => {
          if (prevIndex >= loadingMessages.length - 1) {
            clearInterval(interval);
            return prevIndex;
          }
          return prevIndex + 1;
        });
      }, 5000); // Changes message every 5 seconds
    } else {
      setMessageIndex(0); // Reset if it stops loading
    }
    return () => clearInterval(interval);
  }, [isStarting]);

  return (
    <div className="page-container">
      {/* Title stays at the very top */}
      <h1 className="tight-title" style={{ paddingLeft: '130px' }}>
        Rating Plausibility of Word Senses in Ambiguous Sentences
      </h1>

      {/* New Flex Container for side-by-side layout */}
      <div className="main-content">
        
        {/* Left Side: Overview Texts */}
        <div className="left-column">
          <div className="instruction-box">
            <h3 style={{ marginTop: 0 }}>Overview and explanation:</h3>
            <p style={{ marginBottom: '5%' }}>
            This dataset consists of 5-sentence short stories in Turkish.
            The task is to disambiguate a target <u>homonym</u> word in the fourth
            sentence through contextual clues in surrounding sentences.
            </p>
            <p style={{ marginBottom: '5%' }}>
              Please review the diagram on the right to understand how 
              contextual clues (Precontext and Ambiguous Sentence) affect 
              the meaning of a word.
            </p>
            <p>
              In this task, you will evaluate how well a specific word-sense 
              matches a given scenario on a scale of 1 (poorly matches) to 
              5 (perfectly matches).
            </p>
          </div>
        </div>

        {/* Right Side: Image */}
        <div className="right-column">
          <img 
            src="/walkthrough-diagram.png" 
            alt="Task Diagram" 
            className="image-constrainer-side"
          />
        </div>
        
      </div>

      {/* Footer stays pinned to bottom corners */}
      <div className="button-footer">
        <button className="back-button" onClick={onBack} disabled={isStarting}>
          Back
        </button>
        
        {isStarting && (
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontStyle: 'italic', color: '#555', fontSize: '16px', whiteSpace: 'nowrap' }}>
            {loadingMessages[messageIndex]}
          </div>
        )}

        <button className="next-button" onClick={onStart} disabled={isStarting}>
          {isStarting ? 'Preparing...' : 'Start'}
        </button>
      </div>
    </div>
  );
};

export default Walkthrough;