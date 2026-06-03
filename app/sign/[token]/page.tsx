import SignPage from "@/components/SignPage";

export default function SignRoute({ params }: { params: { token: string } }) {
  return <SignPage token={params.token} />;
}
