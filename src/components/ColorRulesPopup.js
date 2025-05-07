import React, { useEffect, useRef } from 'react';
import '../styles/dashboard.css';

const ColorRulesPopup = ({ colorRules, onClose }) => {
  const popupRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div className="color-rules-popup-backdrop">
      <div className="color-rules-popup-container" ref={popupRef}>
        <div className="color-rules-popup-header">
          <img src="/assets/curaleaf.png" alt="Curaleaf Logo" className="curaleaf-logo" />
          <h3>Color Rules</h3>
          <button className="color-rules-popup-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="color-rules-popup-content">
          <h4>Row-Level Rules</h4>
          {colorRules.row_level.map((rule, index) => (
            <div key={`row-level-${index}`} className="color-rule-item">
              <div className="color-swatch" style={{ backgroundColor: rule.color }}></div>
              <span>{rule.description}</span>
            </div>
          ))}
          <h4>Column-Specific Rules</h4>
          {Object.entries(colorRules)
            .filter(([section]) => section !== 'row_level')
            .map(([section, rules]) => (
              <div key={section}>
                <h5>
                  {section
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')}
                </h5>
                {Object.entries(rules).map(([key, { color, description }], index) => (
                  <div key={`${section}-${key}-${index}`} className="color-rule-item">
                    <div className="color-swatch" style={{ backgroundColor: color }}></div>
                    <span>{description}</span>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ColorRulesPopup;