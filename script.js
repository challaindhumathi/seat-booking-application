document.addEventListener('DOMContentLoaded', () => {
    const seatMap = document.getElementById('seat-map');
    const toast = document.getElementById('toast');
    const resetBtn = document.getElementById('reset-btn');

    // Stats Elements
    const totalSeatsEl = document.getElementById('total-seats');
    const availableCountEl = document.getElementById('available-count');
    const availablePercentEl = document.getElementById('available-percent');
    const bookedCountEl = document.getElementById('booked-count');
    const bookedPercentEl = document.getElementById('booked-percent');
    const bookedBar = document.getElementById('booked-bar');
    const availableTextBar = document.getElementById('available-text-bar');

    // Configuration
    // We expect rows A-E and cols 1-10 from the screenshot visually, although seed might vary.
    // The previous seed was A-E, 1-6. We should update the backend seed or just adapt to what we get.
    // If we want to strictly enforce the visual A-E / 1-10, we'll need to group the flat data.

    // Initial Load
    fetchSeats();

    // Reset Listener
    resetBtn.addEventListener('click', async () => {
        if (!confirm("Are you sure you want to reset all seats?")) return;
        try {
            await fetch('/api/reset', { method: 'POST' });
            showToast('All seats reset!', 'success');
            fetchSeats();
        } catch (error) {
            showToast('Failed to reset seats', 'error');
        }
    });

    async function fetchSeats() {
        try {
            const res = await fetch('/api/seats');
            const seats = await res.json();
            renderSeats(seats);
            updateStats(seats);
        } catch (error) {
            seatMap.innerHTML = '<div style="color:white;text-align:center;">Error loading seats</div>';
            console.error(error);
        }
    }

    function renderSeats(seats) {
        seatMap.innerHTML = '';

        // Group seats by Row (A, B, C...)
        // Assume seat_no format is "RowNumber" e.g. "A1", "A10", "B5"
        const rows = {};

        // Sort seats first naturally to handle A1, A2... A10 correctly
        seats.sort((a, b) => {
            const rowA = a.seat_no.charAt(0);
            const rowB = b.seat_no.charAt(0);
            if (rowA !== rowB) return rowA.localeCompare(rowB);

            const numA = parseInt(a.seat_no.substring(1));
            const numB = parseInt(b.seat_no.substring(1));
            return numA - numB;
        });

        seats.forEach(seat => {
            const rowKey = seat.seat_no.charAt(0);
            if (!rows[rowKey]) rows[rowKey] = [];
            rows[rowKey].push(seat);
        });

        // Render each row
        Object.keys(rows).forEach(rowLabel => {
            const rowDiv = document.createElement('div');
            rowDiv.classList.add('seat-row');

            // Label
            const labelDiv = document.createElement('div');
            labelDiv.classList.add('row-label');
            labelDiv.textContent = rowLabel;
            rowDiv.appendChild(labelDiv);

            // Seats in this row
            rows[rowLabel].forEach(seat => {
                const seatEl = document.createElement('div');
                seatEl.classList.add('seat');
                seatEl.textContent = seat.seat_no; // Display "A1" inside

                if (seat.is_booked) {
                    seatEl.classList.add('booked');
                    seatEl.title = `${seat.seat_no} - Booked`;
                } else {
                    seatEl.title = `${seat.seat_no} - Available`;
                    seatEl.addEventListener('click', () => handleBookSeat(seat.seat_no, seatEl));
                }

                rowDiv.appendChild(seatEl);
            });

            seatMap.appendChild(rowDiv);
        });
    }

    function updateStats(seats) {
        const total = seats.length;
        const booked = seats.filter(s => s.is_booked).length;
        const available = total - booked;

        const bookedPct = total === 0 ? 0 : Math.round((booked / total) * 100);
        const availablePct = total === 0 ? 0 : 100 - bookedPct;

        totalSeatsEl.textContent = total;

        availableCountEl.textContent = available;
        availablePercentEl.textContent = `${availablePct}%`;

        bookedCountEl.textContent = booked;
        bookedPercentEl.textContent = `${bookedPct}%`;

        // Update Progress Bar
        bookedBar.style.width = `${bookedPct}%`;
        availableTextBar.textContent = `${available} Available`;
    }

    async function handleBookSeat(seatNo, seatEl) {
        if (seatEl.classList.contains('booked')) return; // Just in case

        // Optimistic UI update? 
        // Let's do instant feedback then revert if fail
        seatEl.classList.add('booked');
        const originalText = seatEl.textContent;
        seatEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; // Loading spinner

        try {
            const res = await fetch('/api/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seat_no: seatNo })
            });
            const data = await res.json();

            if (res.ok) {
                // Confirm success
                seatEl.textContent = seatNo;
                // Color is already 'booked' class

                // Show floating text or toast
                showToast(`Booked ${seatNo} successfully!`, 'success');

                // Refresh stats to ensure consistency
                // (Optimistic update for stats is possible but refreshing is safer for consistency)
                fetchSeats();
            } else {
                // Revert
                seatEl.classList.remove('booked');
                seatEl.textContent = originalText;
                showToast(data.error || 'Booking failed', 'error');
                fetchSeats(); // Refresh to match server state
            }
        } catch (error) {
            seatEl.classList.remove('booked');
            seatEl.textContent = originalText;
            showToast('Network error', 'error');
        }
    }

    function showToast(msg, type) {
        toast.textContent = msg;
        toast.className = `toast visible`;

        // Remove after 3s
        setTimeout(() => {
            toast.className = 'toast hidden';
        }, 3000);
    }
});
