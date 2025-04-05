import LoginForm from '../components/auth/LoginForm';

const LoginPage = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center space-x-2 mb-4">
          <div className="bg-blue-500 rounded p-1">
            <i className="fas fa-tshirt text-white"></i>
          </div>
          <h1 className="text-2xl font-bold">Mahatma Clothing</h1>
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Stock Management System</h2>
        <p className="text-gray-600 mt-2">Sign in to manage your inventory</p>
      </div>
      
      <div className="w-full max-w-md mx-auto px-4">
        <LoginForm />
      </div>
      
      <div className="mt-10 text-center text-sm text-gray-500">
        <p>© 2025 Mahatma Clothing. All rights reserved.</p>
      </div>
    </div>
  );
};

export default LoginPage;
