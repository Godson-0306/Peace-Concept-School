import { loginAction } from "@/app/(site)/login/actions";

type LoginFormProps = {
  portal?: string | null;
  error?: string | null;
  next?: string | null;
};

export default function LoginForm({
  portal: portalParam,
  error,
  next,
}: LoginFormProps) {
  const initialPortal = portalParam === "staff" ? "staff" : "student";

  return (
    <form action={loginAction} className="login-portal space-y-5">
      {next && next.startsWith("/app") ? (
        <input type="hidden" name="next" value={next} />
      ) : null}

      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--mist)] p-1"
        role="radiogroup"
        aria-label="Sign-in type"
      >
        <label className="login-tab login-tab-student">
          <input
            type="radio"
            name="portal"
            value="student"
            defaultChecked={initialPortal === "student"}
            className="sr-only"
          />
          Student
        </label>
        <label className="login-tab login-tab-staff">
          <input
            type="radio"
            name="portal"
            value="staff"
            defaultChecked={initialPortal === "staff"}
            className="sr-only"
          />
          Staff
        </label>
      </div>

      <p className="text-sm leading-relaxed text-[var(--muted)] when-student">
        Sign in with your Student ID and password issued by the school.
      </p>
      <p className="text-sm leading-relaxed text-[var(--muted)] when-staff">
        Sign in with the username or email and password created when your staff
        account was registered.
      </p>

      <div className="field">
        <label htmlFor="login-identifier">
          <span className="when-student">Student ID</span>
          <span className="when-staff">Username or email</span>
        </label>
        <input
          id="login-identifier"
          name="identifier"
          type="text"
          required
          autoComplete="username"
          autoCorrect="off"
          spellCheck={false}
          className="login-identifier"
          data-student-placeholder="e.g. PCS025001"
          data-staff-placeholder="e.g. admin or email"
          placeholder={
            initialPortal === "student" ? "e.g. PCS025001" : "e.g. admin or email"
          }
        />
      </div>

      <div className="field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      {error ? (
        <p className="form-status error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="login-submit">
        Sign in
      </button>
    </form>
  );
}
