import { useEffect } from "react";
import { useParams } from "react-router-dom";

const SUPABASE_URL = "https://krudxivcuygykoswjbbx.supabase.co";

const VerifyRedirectPage = () => {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    if (slug) {
      window.location.href = `${SUPABASE_URL}/functions/v1/verify-member?slug=${slug}`;
    }
  }, [slug]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
};

export default VerifyRedirectPage;
