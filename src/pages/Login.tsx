
import React from "react";
import AuthLayout from "@/components/authentication/AuthLayout";
import EnhancedLoginForm from "@/components/authentication/EnhancedLoginForm";

const Login: React.FC = () => {
  return (
    <AuthLayout 
      title="Welcome Back" 
      subtitle="Enter your credentials to access your secure chat"
    >
      <EnhancedLoginForm />
    </AuthLayout>
  );
};

export default Login;
