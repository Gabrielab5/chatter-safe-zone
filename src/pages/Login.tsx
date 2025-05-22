
import React from "react";
import AuthLayout from "@/components/authentication/AuthLayout";
import LoginForm from "@/components/authentication/LoginForm";

const Login: React.FC = () => {
  return (
    <AuthLayout 
      title="Welcome Back" 
      subtitle="Enter your credentials to access your account"
    >
      <LoginForm />
    </AuthLayout>
  );
};

export default Login;
