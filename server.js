const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

dotenv.config();

// For Vercel, use temp directory
const uploadDir = process.env.NODE_ENV === 'production' 
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(__dirname, 'uploads');

fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use('/uploads', express.static(uploadDir));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL environment variable.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('✅ Verifying database connection...');
    
    // Just verify schema exists - don't run SQL file (it's already been run)
    const userTableCheck = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')`
    );
    
    const functionCheck = await client.query(
      `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE 'fn_%'`
    );
    
    if (!userTableCheck.rows[0].exists) {
      console.error('❌ Error: users table does not exist. Run db_start.sql first.');
      process.exit(1);
    }
    
    console.log(`✅ Database verified. Found ${functionCheck.rows.length} functions:`);
    functionCheck.rows.forEach(row => {
      console.log(`   - ${row.routine_name}`);
    });
    
  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

function mapUser(row) {
  return {
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    avatar: row.avatar || '',
  };
}

function mapTaskGroup(row) {
  let details = [];
  try {
    if (row.details && Array.isArray(row.details)) {
      details = row.details.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description || '',
        status: d.status,
        startDate: d.startDate,
        dueDate: d.dueDate,
        assignees: d.assignees || [],
      }));
    }
  } catch (e) {
    console.warn('Error parsing details:', e);
  }
  
  return {
    id: row.id,
    title: row.title,
    startDate: row.start_date,
    dueDate: row.due_date,
    members: row.members || [],
    isTeam: row.is_team,
    details,
  };
}

// ============================================
// Health Check
// ============================================
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    return res.json({ ok: true, now: result.rows[0].now });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================
// User Management
// ============================================
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('🔐 /api/login called:', { username });
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username và password là bắt buộc.' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM fn_login_user($1, $2)',
      [username, password]
    );
    console.log('✅ fn_login_user returned:', result.rows.length, 'rows');
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }
    return res.json(mapUser(result.rows[0]));
  } catch (error) {
    console.error('❌ /api/login error:', error.message);
    return res.status(401).json({ error: error.message });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, fullName, email, password } = req.body;
  console.log('👤 /api/register called:', { username, fullName, email });
  
  if (!username || !fullName || !email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin.' });
  }
  try {
    console.log('🔨 Calling fn_register_user()...');
    const result = await pool.query(
      'SELECT * FROM fn_register_user($1, $2, $3, $4)',
      [username, fullName, email, password]
    );
    console.log('✅ fn_register_user returned:', result.rows.length, 'rows');
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Không thể tạo tài khoản' });
    }
    return res.status(201).json(mapUser(result.rows[0]));
  } catch (error) {
    console.error('❌ /api/register error:', error.message);
    return res.status(409).json({ error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  console.log('📋 /api/users called');
  try {
    const result = await pool.query('SELECT * FROM fn_get_users()');
    console.log('✅ fn_get_users returned:', result.rows.length, 'users');
    return res.json(result.rows.map(mapUser));
  } catch (error) {
    console.error('❌ /api/users error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.patch('/api/users/:username', async (req, res) => {
  const { username } = req.params;
  const { fullName, avatar } = req.body;
  console.log('✏️  /api/users/:username called:', { username, fullName });
  
  if (!username || !fullName) {
    return res.status(400).json({ error: 'Dữ liệu người dùng không hợp lệ.' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM fn_update_user_profile($1, $2, $3)',
      [username, fullName, avatar || '']
    );
    console.log('✅ fn_update_user_profile returned:', result.rows.length, 'rows');
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    }
    return res.json(mapUser(result.rows[0]));
  } catch (error) {
    console.error('❌ /api/users/:username error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.patch('/api/users/:username/password', async (req, res) => {
  const { username } = req.params;
  const { currentPassword, newPassword } = req.body;
  console.log('🔑 /api/users/:username/password called:', { username });
  
  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Dữ liệu mật khẩu không hợp lệ.' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM fn_change_user_password($1, $2, $3)',
      [username, currentPassword, newPassword]
    );
    console.log('✅ fn_change_user_password executed');
    return res.json({ ok: true });
  } catch (error) {
    console.error('❌ /api/users/:username/password error:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/users/:username/avatar', upload.single('avatar'), async (req, res) => {
  const { username } = req.params;
  console.log('📷 /api/users/:username/avatar called:', { username });
  
  if (!req.file) {
    return res.status(400).json({ error: 'Vui lòng chọn ảnh để tải lên.' });
  }
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const avatarUrl = `${baseUrl}/uploads/${req.file.filename}`;

  try {
    const result = await pool.query(
      'SELECT * FROM fn_update_user_profile($1, (SELECT full_name FROM users WHERE username = $1), $2)',
      [username, avatarUrl]
    );
    console.log('✅ Avatar updated');
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    }
    return res.json(mapUser(result.rows[0]));
  } catch (error) {
    console.error('❌ /api/users/:username/avatar error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================
// Task Groups Management
// ============================================
app.get('/api/task-groups', async (req, res) => {
  console.log('📦 /api/task-groups called');
  try {
    const result = await pool.query('SELECT * FROM fn_get_task_groups()');
    console.log('✅ fn_get_task_groups returned:', result.rows.length, 'groups');
    return res.json(result.rows.map(mapTaskGroup));
  } catch (error) {
    console.error('❌ /api/task-groups error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/task-groups', async (req, res) => {
  const { id, title, startDate, dueDate, members, isTeam, details } = req.body;
  console.log('✨ /api/task-groups POST called:', { id, title, isTeam, detailsCount: details?.length });
  
  if (!id || !title || !startDate || typeof isTeam !== 'boolean' || !Array.isArray(details)) {
    return res.status(400).json({ error: 'Dữ liệu nhóm không hợp lệ.' });
  }
  try {
    const detailsJson = JSON.stringify(details);
    console.log('🔨 Calling fn_create_task_group()...');
    const result = await pool.query(
      'SELECT * FROM fn_create_task_group($1, $2, $3, $4, $5, $6, $7::jsonb)',
      [id, title, startDate, dueDate || null, members || [], isTeam, detailsJson]
    );
    console.log('✅ fn_create_task_group returned:', result.rows.length, 'rows');
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Không thể tạo nhóm công việc' });
    }
    return res.status(201).json(mapTaskGroup(result.rows[0]));
  } catch (error) {
    console.error('❌ /api/task-groups POST error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================
// Task Details Management
// ============================================
app.patch('/api/task-details/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  console.log('⚡ /api/task-details/:id/status called:', { id, status });
  
  if (!id || !status) {
    return res.status(400).json({ error: 'Dữ liệu status không hợp lệ.' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM fn_update_task_status($1, $2)',
      [id, status]
    );
    console.log('✅ fn_update_task_status returned:', result.rows.length, 'rows');
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task không tồn tại.' });
    }
    return res.json({
      id: result.rows[0].id,
      title: result.rows[0].title,
      description: result.rows[0].description,
      status: result.rows[0].status,
      startDate: result.rows[0].start_date,
      dueDate: result.rows[0].due_date,
      assignees: result.rows[0].assignees,
    });
  } catch (error) {
    console.error('❌ /api/task-details/:id/status error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================
// Initialize and Start Server
// ============================================
const port = process.env.PORT || 3000;

// For Vercel, we export as a handler
module.exports = (req, res) => {
  initDatabase()
    .then(() => {
      app(req, res);
    })
    .catch((error) => {
      console.error('Failed to initialize database:', error);
      res.status(500).json({ error: 'Database initialization failed' });
    });
};

// For local development
if (process.env.NODE_ENV !== 'production') {
  initDatabase()
    .then(() => {
      app.listen(port, () => {
        console.log(`Backend server listening on http://localhost:${port}`);
      });
    })
    .catch((error) => {
      console.error('Failed to initialize database:', error);
      process.exit(1);
    });
}
