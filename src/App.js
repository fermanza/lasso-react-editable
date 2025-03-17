// src/App.js
import React from 'react';
import LassoTool from './LassoTool';

function App() {
    return (
        <div>
            <h1>Lasso Crop Tool Example</h1>
            <LassoTool
                imageUrl="https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?fit=crop&w=600&h=400&q=80"
                width={600}
                height={400}
            />
        </div>
    );
}

export default App;