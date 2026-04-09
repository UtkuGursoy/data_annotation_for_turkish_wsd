import { useState } from 'react';
import './ParticipantInfo.css';

// Added 'initialData' to the props
const ParticipantInfo = ({ onNext, initialData }) => {
  // Initialize state with initialData (passed from App.jsx) 
  // or the default empty object if it's the first time loading
  const [formData, setFormData] = useState(initialData || {
    fullName: '',
    age: '',
    educationDegree: ''
  });
  const [didAnnotateBefore, setDidAnnotateBefore] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Name Validation: Alphabetic + Turkish characters + Spaces
    if (name === 'fullName') {
      const alphaRegex = /^[a-zA-ZğüşiöçĞÜŞİÖÇ\s]*$/;
      if (!alphaRegex.test(value)) return;
    }

    // Age Validation: Numeric only, max 90, no leading zeros
    if (name === 'age') {
      if (value !== '') {
        const numericRegex = /^[0-9]*$/;
        if (!numericRegex.test(value)) return;
        const num = parseInt(value, 10);
        if (num > 90 || value.startsWith('0')) return;
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Validation logic
  const isComplete = didAnnotateBefore
    ? formData.fullName.trim().length > 2
    : formData.fullName.trim().length > 2 && 
      (parseInt(formData.age, 10) >= 10 && parseInt(formData.age, 10) <= 90) && 
      formData.educationDegree !== "" && 
      formData.educationDegree !== "Select";

  return (
    <div className="page-container">
      <h1 className="main-title" style={{ textAlign: 'center', width: '100%', paddingLeft: '45px' }}>
        Data Annotation for Turkish Word-Sense Disambiguation
      </h1>

      <div className="form-container">
        {/* Full Name */}
        <div className="form-group">
          <label>Full Name:</label>
          <input 
            type="text" 
            name="fullName"
            placeholder="Name Surname"
            className="form-input" 
            value={formData.fullName}
            onChange={handleChange}
          />
        </div>

        {!didAnnotateBefore && (
          <>
            {/* Age */}
            <div className="form-group">
              <label>Age:</label>
              <input 
                type="text" 
                name="age"
                placeholder="Ex: 25"
                className="form-input" 
                value={formData.age}
                onChange={handleChange}
              />
            </div>

            {/* Education Degree Dropdown */}
            <div className="form-group">
              <label>Education Degree:</label>
              <select 
                name="educationDegree" 
                className="form-select"
                value={formData.educationDegree}
                onChange={handleChange}
              >
                <option value="">Select</option>
                <option value="Primary School">Primary School</option>
                <option value="Middle School">Middle School</option>
                <option value="High School">High School</option>
                <option value="Bachelor's">Bachelor's</option>
                <option value="Master's">Master's</option>
                <option value="PhD">PhD</option>
              </select>
            </div>
          </>
        )}

        {/* Annotations Before Checkbox */}
        <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
          <label style={{ margin: 0, width: 'auto' }}>I did annotations before:</label>
          <input 
            type="checkbox" 
            checked={didAnnotateBefore}
            onChange={(e) => setDidAnnotateBefore(e.target.checked)}
            style={{ margin: 0, width: 'auto', transform: 'scale(1.2)' }}
          />
        </div>
        
        <div className="button-footer-info">
        <button 
          className="next-button" 
          disabled={!isComplete}
          onClick={() => onNext(formData)}
        >
          Next
        </button>
      </div>
      </div>
    </div>
  );
};

export default ParticipantInfo;