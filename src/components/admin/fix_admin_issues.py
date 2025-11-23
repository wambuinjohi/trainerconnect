#!/usr/bin/env python3

import re
import os

filepath = 'src/components/admin/AdminDashboard.tsx'

# Read the file
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the activeIssue modal section
start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if '{activeIssue && (' in line:
        start_idx = i
    if start_idx is not None and end_idx is None and ')}' in line and 'Mark Resolved' in lines[i-2]:
        end_idx = i
        break

if start_idx is not None and end_idx is not None:
    print(f"Found activeIssue modal from line {start_idx} to {end_idx}")
    
    # Create the new modal code
    new_modal_lines = '''      <AlertDialog open={!!activeIssue} onOpenChange={(open) => {
        if (!open) setActiveIssue(null)
      }}>
        {activeIssue && (
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Issue {activeIssue.id}</AlertDialogTitle>
              <AlertDialogDescription>Type: {activeIssue.complaint_type}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Description</p>
                <p className="text-sm text-muted-foreground">{activeIssue.description}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Booking Reference</p>
                <p className="text-sm text-muted-foreground">{activeIssue.booking_reference || 'Not provided'}</p>
              </div>
              {(activeIssue.attachments || []).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Attachments</p>
                  <div className="grid grid-cols-1 gap-2">
                    {(activeIssue.attachments || []).map((a:any,i:number)=>(
                      <a key={i} href={a} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Attachment {i+1}</a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
              <Button onClick={()=>{ markIssueResolved(activeIssue); setActiveIssue(null) }} className="bg-gradient-primary text-white">Mark Resolved</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
'''
    
    # Replace the section
    new_lines = lines[:start_idx] + [new_modal_lines + '\n'] + lines[end_idx+1:]
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print("File updated successfully")
else:
    print(f"Could not find section: start_idx={start_idx}, end_idx={end_idx}")
