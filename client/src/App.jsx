import { useState } from 'react';
import './index.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        <div className="text-6xl mb-4">🏫</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Room Allocation System
        </h1>
        <p className="text-gray-600 mb-6">NIT Raipur</p>
        
        <div className="flex items-center justify-center gap-4">
          <button 
            onClick={() => setCount(count - 1)}
            className="btn-danger"
          >
            -
          </button>
          <span className="text-2xl font-bold w-16">{count}</span>
          <button 
            onClick={() => setCount(count + 1)}
            className="btn-primary"
          >
            +
          </button>
        </div>
        
        <p className="mt-6 text-sm text-gray-500">
          Tailwind CSS is working! ✅
        </p>
      </div>
    </div>
  );
}

export default App;
