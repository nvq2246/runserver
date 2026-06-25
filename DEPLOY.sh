#!/bin/bash
# Quick deployment checklist for Vercel backend

echo "🚀 TaskManagement Backend - Deployment Checklist"
echo "=================================================="
echo ""

# Check files
echo "✓ Checking required files..."
required_files=("server.js" "db_start.sql" "package.json" "vercel.json" ".env.example" "README.md")
for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ Missing: $file"
  fi
done

echo ""
echo "📋 Next steps:"
echo "1. Commit to Git: git add . && git commit -m 'Add Vercel backend'"
echo "2. Push to GitHub: git push origin main"
echo "3. Go to https://vercel.com/new and import your repo"
echo "4. Set project root to: /runvercel"
echo "5. Add DATABASE_URL environment variable"
echo "6. Redeploy and test /api/health endpoint"
echo ""
echo "✨ Done! Your backend is now running 24/7 on Vercel"
