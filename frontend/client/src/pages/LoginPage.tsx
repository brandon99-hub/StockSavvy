import React from 'react';
import LoginForm from '../components/auth/LoginForm';
import logo from '../../assets/appstore_logo.png';

const LoginPage = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center space-x-4 mb-6">
          <img src={logo} alt="Working Wave Logo" className="w-14 h-14 drop-shadow-lg" />
          <h1 className="text-3xl font-extrabold tracking-tight text-blue-700 drop-shadow-sm">Working Wave</h1>
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Stock Management System</h2>
        <p className="text-gray-600 mt-2">Sign in to manage your inventory</p>
      </div>
      
      <div className="w-full max-w-md mx-auto px-4">
        <LoginForm />
      </div>
      
      <div className="mt-10 text-center text-sm text-gray-500">
        <p>© 2025 Working Wave. All rights reserved.</p>
      </div>
    </div>
  );
};

export default LoginPage;
