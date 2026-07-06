export default function StakingPortal() {
  if (typeof window !== 'undefined') {
    window.location.replace('/index.html');
  }
  return null;
}