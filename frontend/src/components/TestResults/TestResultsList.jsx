import React from 'react';
import TestResultItem from './TestResultItem.jsx';

/**
 * TestResultsList
 *
 * Renders an ordered list of test results using TestResultItem.
 * Provides an empty-state placeholder when there are no results yet.
 *
 * Styling mirrors the scrollable results container in App.jsx so that
 * future migration of App.jsx can drop this in as a direct replacement.
 *
 * @param {Object}   props
 * @param {Array}    props.results      - Array of result objects (see TestResultItem).
 * @param {string}   [props.emptyText]  - Override the default empty-state message.
 * @param {string}   [props.className]  - Extra CSS classes for the wrapper element.
 */
const TestResultsList = ({
  results = [],
  emptyText = 'No test results yet.',
  className = '',
}) => {
  if (results.length === 0) {
    return (
      <div className={`text-center py-8 text-slate-500 text-sm font-mono ${className}`}>
        {emptyText}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {results.map((result, idx) => (
        <TestResultItem key={idx} result={result} idx={idx} />
      ))}
    </div>
  );
};

export default TestResultsList;
