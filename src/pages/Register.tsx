
import React from "react";
import AuthLayout from "@/components/authentication/AuthLayout";
import EnhancedRegisterForm from "@/components/authentication/EnhancedRegisterForm";

const Register: React.FC = () => {
  return (
    <AuthLayout 
      title="Create Account" 
      subtitle="Join SecureTalk for secure messaging"
    >
      <EnhancedRegisterForm />
    </AuthLayout>
  );
};

export default Register;
