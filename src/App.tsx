/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import InventoryView from './components/InventoryView';
import { AppProvider } from './context/AppContext';

export default function App() {
  const [isInventoryRoute, setIsInventoryRoute] = useState(false);

  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;
      
      const isInv = 
        path === '/inventory' || 
        path.endsWith('/inventory') || 
        hash === '#/inventory' || 
        hash === '#inventory' ||
        search.includes('view=inventory');
        
      setIsInventoryRoute(isInv);
    };

    checkRoute();
    
    // Listen for navigation changes
    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);
    
    return () => {
      window.removeEventListener('popstate', checkRoute);
      window.removeEventListener('hashchange', checkRoute);
    };
  }, []);

  if (isInventoryRoute) {
    return (
      <AppProvider>
        <div className="h-screen w-screen bg-slate-50 overflow-hidden flex flex-col">
          <InventoryView />
        </div>
      </AppProvider>
    );
  }

  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  );
}

