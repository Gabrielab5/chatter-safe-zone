
import React from "react";
import AuthLayout from "@/components/authentication/AuthLayout";
import RegisterForm from "@/components/authentication/RegisterForm";

const Register: React.FC = () => {
  return (
    <AuthLayout 
      title="Create Account" 
      subtitle="Sign up to get started with SecureTalk"
    >
      <RegisterForm />
    </AuthLayout>
  );
};

export default Register;
