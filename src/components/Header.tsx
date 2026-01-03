import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLogo from '@/components/auth/AuthLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { Button } from '@/components/ui/button'
import WaitlistDialog from '@/components/WaitlistDialog'

const NavLink: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Link to={to} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
    {children}
  </Link>
)

const Header: React.FC = () => {
  const [open, setOpen] = React.useState(false)
  const [waitlistOpen, setWaitlistOpen] = React.useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6 lg:gap-8">
            <AuthLogo compact containerClassName="h-16 w-16" className="h-16" />
            <nav className="hidden md:flex items-center gap-8">
              <NavLink to="/">Home</NavLink>
              <NavLink to="/explore">Explore</NavLink>
              <NavLink to="/about">About</NavLink>
              <NavLink to="/contact">Contact</NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="md:hidden">
              <button
                aria-label="menu"
                onClick={() => setOpen(v => !v)}
                className="p-2 rounded-md hover:bg-accent transition-colors text-base font-medium"
              >
                {open ? 'Close' : 'Menu'}
              </button>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setWaitlistOpen(true)}
                className="text-trainer-primary border-trainer-primary"
              >
                Join Waitlist
              </Button>
              <Link to="/signin">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link to="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {open && (
          <div className="md:hidden border-t border-border py-6 px-2">
            <nav className="flex flex-col gap-2">
              <NavLink to="/">Home</NavLink>
              <NavLink to="/explore">Explore</NavLink>
              <NavLink to="/about">About</NavLink>
              <NavLink to="/contact">Contact</NavLink>
              <div className="border-t border-border pt-4 mt-2 space-y-2">
                <Button
                  variant="outline"
                  onClick={() => setWaitlistOpen(true)}
                  className="w-full text-trainer-primary border-trainer-primary"
                >
                  Join Waitlist
                </Button>
                <Link to="/signin" className="block">
                  <Button variant="ghost" className="w-full justify-center">Sign In</Button>
                </Link>
                <Link to="/signup" className="block">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* Waitlist Dialog */}
      <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </header>
  )
}

export default Header
