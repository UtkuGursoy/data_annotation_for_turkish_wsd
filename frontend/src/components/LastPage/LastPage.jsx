import { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import './LastPage.css';

const LastPage = ({ totalTasks }) => {
  const totalGroups = Math.ceil(totalTasks / 3);
  const [windowSize, setWindowSize] = useState({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    
    window.addEventListener("resize", handleResize);
    handleResize();
    
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="last-page-container">
      <Confetti
        width={windowSize.width}
        height={windowSize.height}
        recycle={false}
        numberOfPieces={500}
        tweenDuration={10000}
      />
      <div className="last-page-content">
        <h1 className="main-title last-page-title">Thank You!</h1>
        <div className="form-container last-page-form">
          <p className="last-page-text first-text">You have completed all the data annotations.</p>
          <p className="last-page-text">Your responses have been successfully saved.</p>
          <button 
            className="next-button finish-button" 
            onClick={() => window.location.reload()}
          >
            Finish
          </button>
        </div>
      </div>
      <div className="progress-wrapper">
        <div className="progress-fill" style={{ width: '100%' }} />
        <span className="progress-text">Progress: {totalGroups} / {totalGroups}</span>
      </div>
    </div>
  );
};

export default LastPage;