-- TaskManagement Database Schema and Functions
-- This file initializes the database with tables and stored functions
-- Run this once during deployment: psql -U user -d database < db_start.sql

-- Drop functions in correct order (dependent functions first, then their dependencies)
DROP FUNCTION IF EXISTS fn_register_user(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS fn_login_user(TEXT, TEXT);
DROP FUNCTION IF EXISTS fn_change_user_password(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS fn_hash_password(TEXT);
DROP FUNCTION IF EXISTS fn_get_users();
DROP FUNCTION IF EXISTS fn_create_task_group(TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS fn_get_task_groups();
DROP FUNCTION IF EXISTS fn_update_task_status(TEXT, TEXT);
DROP FUNCTION IF EXISTS fn_update_user_profile(TEXT, TEXT, TEXT);

DROP TABLE IF EXISTS task_details CASCADE;
DROP TABLE IF EXISTS task_groups CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
  username TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar TEXT DEFAULT ''
);

-- Create task_groups table
CREATE TABLE task_groups (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  due_date TEXT,
  members TEXT[] NOT NULL DEFAULT '{}',
  is_team BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create task_details table
CREATE TABLE task_details (
  id TEXT PRIMARY KEY,
  group_id TEXT REFERENCES task_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Chưa bắt đầu',
  start_date TEXT,
  due_date TEXT,
  assignees TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Function: Hash password using simple encoding (for demo only, use bcrypt in production)
CREATE OR REPLACE FUNCTION fn_hash_password(raw_password TEXT)
RETURNS TEXT AS $$
BEGIN
  -- For demo purposes, use a simple hash. In production, use pgcrypto extension:
  -- SELECT crypt(raw_password, gen_salt('bf'))
  -- For now, just return the password as-is (you should upgrade this)
  RETURN raw_password;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Register a new user
CREATE OR REPLACE FUNCTION fn_register_user(
  p_username TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_password TEXT
)
RETURNS TABLE(
  username TEXT,
  full_name TEXT,
  email TEXT,
  avatar TEXT
) AS $$
BEGIN
  -- Check if user already exists
  IF EXISTS(SELECT 1 FROM users WHERE username = p_username) THEN
    RAISE EXCEPTION 'Tên đăng nhập đã tồn tại';
  END IF;

  -- Insert new user
  INSERT INTO users (username, full_name, email, password_hash, avatar)
  VALUES (p_username, p_full_name, p_email, fn_hash_password(p_password), '');

  RETURN QUERY
  SELECT u.username, u.full_name, u.email, u.avatar
  FROM users u
  WHERE u.username = p_username;
END;
$$ LANGUAGE plpgsql;

-- Function: Login user
CREATE OR REPLACE FUNCTION fn_login_user(p_username TEXT, p_password TEXT)
RETURNS TABLE(
  username TEXT,
  full_name TEXT,
  email TEXT,
  avatar TEXT
) AS $$
BEGIN
  -- Verify user exists and password matches
  IF NOT EXISTS(
    SELECT 1 FROM users 
    WHERE username = p_username 
      AND password_hash = fn_hash_password(p_password)
  ) THEN
    RAISE EXCEPTION 'Tên đăng nhập hoặc mật khẩu không chính xác';
  END IF;

  RETURN QUERY
  SELECT u.username, u.full_name, u.email, u.avatar
  FROM users u
  WHERE u.username = p_username;
END;
$$ LANGUAGE plpgsql;

-- Function: Get all users
CREATE OR REPLACE FUNCTION fn_get_users()
RETURNS TABLE(
  username TEXT,
  full_name TEXT,
  email TEXT,
  avatar TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.username, u.full_name, u.email, u.avatar
  FROM users u
  ORDER BY u.username;
END;
$$ LANGUAGE plpgsql;

-- Function: Create task group with details
CREATE OR REPLACE FUNCTION fn_create_task_group(
  p_id TEXT,
  p_title TEXT,
  p_start_date TEXT,
  p_due_date TEXT,
  p_members TEXT[],
  p_is_team BOOLEAN,
  p_details JSONB
)
RETURNS TABLE(
  id TEXT,
  title TEXT,
  start_date TEXT,
  due_date TEXT,
  members TEXT[],
  is_team BOOLEAN,
  details JSONB
) AS $$
BEGIN
  -- Insert task group
  INSERT INTO task_groups (id, title, start_date, due_date, members, is_team)
  VALUES (p_id, p_title, p_start_date, p_due_date, p_members, p_is_team);

  -- Insert task details from JSONB array using INSERT INTO ... SELECT
  INSERT INTO task_details (id, group_id, title, description, status, start_date, due_date, assignees)
  SELECT
    elem->>'id',
    p_id,
    elem->>'title',
    COALESCE(elem->>'description', ''),
    COALESCE(elem->>'status', 'Chưa bắt đầu'),
    elem->>'startDate',
    elem->>'dueDate',
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(elem->'assignees')),
      '{}'::TEXT[]
    )
  FROM jsonb_array_elements(p_details) AS elem;

  -- Return created group with details
  RETURN QUERY
  SELECT
    g.id,
    g.title,
    g.start_date,
    g.due_date,
    g.members,
    g.is_team,
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'title', d.title,
        'description', d.description,
        'status', d.status,
        'startDate', d.start_date,
        'dueDate', d.due_date,
        'assignees', d.assignees
      )
    ) FILTER (WHERE d.id IS NOT NULL)
  FROM task_groups g
  LEFT JOIN task_details d ON d.group_id = g.id
  WHERE g.id = p_id
  GROUP BY g.id, g.title, g.start_date, g.due_date, g.members, g.is_team;
END;
$$ LANGUAGE plpgsql;

-- Function: Get task groups with details
CREATE OR REPLACE FUNCTION fn_get_task_groups()
RETURNS TABLE(
  id TEXT,
  title TEXT,
  start_date TEXT,
  due_date TEXT,
  members TEXT[],
  is_team BOOLEAN,
  details JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.title,
    g.start_date,
    g.due_date,
    g.members,
    g.is_team,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'title', d.title,
          'description', d.description,
          'status', d.status,
          'startDate', d.start_date,
          'dueDate', d.due_date,
          'assignees', d.assignees
        ) ORDER BY d.id
      ) FILTER (WHERE d.id IS NOT NULL),
      '[]'::JSONB
    )
  FROM task_groups g
  LEFT JOIN task_details d ON d.group_id = g.id
  GROUP BY g.id, g.title, g.start_date, g.due_date, g.members, g.is_team
  ORDER BY g.id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update task status
CREATE OR REPLACE FUNCTION fn_update_task_status(p_id TEXT, p_status TEXT)
RETURNS TABLE(
  id TEXT,
  title TEXT,
  description TEXT,
  status TEXT,
  start_date TEXT,
  due_date TEXT,
  assignees TEXT[]
) AS $$
BEGIN
  UPDATE task_details SET status = p_status WHERE id = p_id;

  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.description,
    d.status,
    d.start_date,
    d.due_date,
    d.assignees
  FROM task_details d
  WHERE d.id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update user profile
CREATE OR REPLACE FUNCTION fn_update_user_profile(p_username TEXT, p_full_name TEXT, p_avatar TEXT)
RETURNS TABLE(
  username TEXT,
  full_name TEXT,
  email TEXT,
  avatar TEXT
) AS $$
BEGIN
  UPDATE users 
  SET full_name = p_full_name, avatar = COALESCE(p_avatar, '')
  WHERE username = p_username;

  RETURN QUERY
  SELECT u.username, u.full_name, u.email, u.avatar
  FROM users u
  WHERE u.username = p_username;
END;
$$ LANGUAGE plpgsql;

-- Function: Change user password
CREATE OR REPLACE FUNCTION fn_change_user_password(
  p_username TEXT,
  p_current_password TEXT,
  p_new_password TEXT
)
RETURNS TABLE(ok BOOLEAN) AS $$
BEGIN
  -- Verify current password
  IF NOT EXISTS(
    SELECT 1 FROM users
    WHERE username = p_username
      AND password_hash = fn_hash_password(p_current_password)
  ) THEN
    RAISE EXCEPTION 'Mật khẩu hiện tại không chính xác';
  END IF;

  -- Verify new password length
  IF LENGTH(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Mật khẩu mới phải có ít nhất 6 ký tự';
  END IF;

  -- Update password
  UPDATE users
  SET password_hash = fn_hash_password(p_new_password)
  WHERE username = p_username;

  RETURN QUERY SELECT TRUE;
END;
$$ LANGUAGE plpgsql;
