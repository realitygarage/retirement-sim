cd "$env:USERPROFILE\retirement-sim"
Start-Transcript -Path "test-results\test-run.txt" -Force
npx playwright test retirement-simulator.spec.js --reporter=list --headed
Stop-Transcript
