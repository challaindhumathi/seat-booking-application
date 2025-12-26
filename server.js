require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL || 'https://sglhnrtmyxgrjvgmbfbp.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnbGhucnRteXhncmp2Z21iZmJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NTMyODMsImV4cCI6MjA4MjMyOTI4M30.UDJ091z0AhUwcC-FQPZzQsVsnv5-EGI96CMISKJzCbE';
const supabase = createClient(supabaseUrl, supabaseKey);

// Init check (just logging)
console.log(`Connected to Supabase project: ${supabaseUrl}`);

// API Routes

// Get all seats
app.get('/api/seats', async (req, res) => {
    const { data, error } = await supabase
        .from('seats')
        .select('*')
        .order('seat_no', { ascending: true });

    if (error) {
        console.error('Error fetching seats:', error);
        return res.status(500).json({ error: error.message });
    }

    // If empty (table might be new), user needs to seed it.
    // For this demo, we won't auto-seed from backend because we lack admin rights with anon key usually,
    // unless RLS allows insert.
    res.json(data);
});

// Book a seat
app.post('/api/book', async (req, res) => {
    const { seat_no } = req.body;

    if (!seat_no) {
        return res.status(400).json({ error: "Seat number is required" });
    }

    // 1. Check if seat is available
    const { data: seat, error: fetchError } = await supabase
        .from('seats')
        .select('is_booked')
        .eq('seat_no', seat_no)
        .single();

    if (fetchError) {
        if (fetchError.code === 'PGRST116') { // Not found
            return res.status(404).json({ error: "Seat not found" });
        }
        return res.status(500).json({ error: fetchError.message });
    }

    if (seat.is_booked) {
        return res.status(409).json({ error: "Seat already booked" });
    }

    // 2. Optimistic Update / Update
    // Note: With high concurrency, checking then updating isn't perfectly atomic without a stored procedure
    // or RLS constraints. But for this level, we try to update where is_booked is false.

    const { data: updatedData, error: updateError } = await supabase
        .from('seats')
        .update({ is_booked: true })
        .eq('seat_no', seat_no)
        .eq('is_booked', false) // Optimistic locking equivalent
        .select();

    if (updateError) {
        return res.status(500).json({ error: updateError.message });
    }

    if (!updatedData || updatedData.length === 0) {
        // This implies someone else booked it in between the check and the update
        return res.status(409).json({ error: "Seat already booked by another user" });
    }

    res.json({ message: `Seat ${seat_no} booked successfully`, seat_no });
});

// Reset all seats 
app.post('/api/reset', async (req, res) => {
    const { error } = await supabase
        .from('seats')
        .update({ is_booked: false })
        .neq('seat_no', 'placeholder'); // Update all (Postgres usually requires a WHERE, 'neq' implies all if arg is valid)

    // Better way to update all rows in supabase client without 'where' clause warning:
    // .or('seat_no.neq.null')

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "All seats reset" });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
