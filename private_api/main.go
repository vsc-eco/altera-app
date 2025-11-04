package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

func main() {
	router := mux.NewRouter()

	// configure CORS
	var (
		allowedOrigins = []string{"https://altera.vsc.eco"}
		allowedMethods = []string{http.MethodGet, http.MethodOptions, http.MethodPost}
		allowedHeaders = []string{"Content-Type"}
	)

	if os.Getenv("DEBUG") == "1" {
		allowedOrigins = append(allowedOrigins, "https://localhost:5173")
	}

	router.Use(handlers.CORS(
		handlers.AllowedMethods(allowedMethods),
		handlers.AllowedOrigins(allowedOrigins),
		handlers.AllowedHeaders(allowedHeaders),
	))

	router.HandleFunc("/", handleOnRamp).Methods(http.MethodPost)

	const localAddr = "0.0.0.0:5174"
	log.Fatal(http.ListenAndServe(
		localAddr,
		handlers.LoggingHandler(os.Stdout, router),
	))
}

func handleOnRamp(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusTeapot)
	w.Write([]byte("as;ldkfjasdlkjf"))
}
